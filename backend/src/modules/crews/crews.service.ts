import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmployeeStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import { CreateCrewDto, UpdateCrewDto } from './dto/crews.dto';

@Injectable()
export class CrewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.supervisorId) where.supervisorId = query.supervisorId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { code: { contains: String(query.search), mode: 'insensitive' } },
        { name: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.crew.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, code: true, name: true } },
          shift: { select: { id: true, code: true, name: true, type: true } },
          supervisor: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
          _count: { select: { employees: true } },
        },
      }),
      this.prisma.crew.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const crew = await this.prisma.crew.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        project: { select: { id: true, code: true, name: true } },
        shift: { select: { id: true, code: true, name: true, type: true, startTime: true, endTime: true } },
        supervisor: {
          select: { id: true, code: true, firstName: true, lastName: true, position: true },
        },
        employees: {
          select: { id: true, code: true, firstName: true, lastName: true, position: true, status: true },
          orderBy: { code: 'asc' },
        },
      },
    });
    if (!crew) throw new NotFoundException('Cuadrilla no encontrada');
    return crew;
  }

  async create(tenantId: string, dto: CreateCrewDto, actorId: string) {
    await this.assertProject(tenantId, dto.projectId);
    await this.assertShift(tenantId, dto.shiftId);
    await this.assertEmployee(tenantId, dto.supervisorId);

    const crew = await this.prisma.crew.create({
      data: tenantData(tenantId, {
        projectId: dto.projectId,
        shiftId: dto.shiftId || null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        supervisorId: dto.supervisorId || null,
        status: dto.status || EmployeeStatus.ACTIVE,
      }) as Prisma.CrewUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Crew',
      entityId: crew.id,
      after: dto,
    });
    return this.findOne(tenantId, crew.id);
  }

  async update(tenantId: string, id: string, dto: UpdateCrewDto, actorId: string) {
    await this.findOne(tenantId, id);
    await this.assertProject(tenantId, dto.projectId);
    await this.assertShift(tenantId, dto.shiftId);
    await this.assertEmployee(tenantId, dto.supervisorId);

    const data: Record<string, any> = {};
    if (dto.projectId !== undefined) data.projectId = dto.projectId;
    if (dto.shiftId !== undefined) data.shiftId = dto.shiftId;
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.supervisorId !== undefined) data.supervisorId = dto.supervisorId;
    if (dto.status !== undefined) data.status = dto.status;

    await this.prisma.crew.updateMany({ where: tenantWhere(tenantId, { id }), data });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Crew',
      entityId: id,
      after: dto,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    await this.findOne(tenantId, id);
    await this.prisma.crew.deleteMany({ where: tenantWhere(tenantId, { id }) });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Crew',
      entityId: id,
    });
    return { success: true };
  }

  private async assertProject(tenantId: string, id?: string) {
    if (!id) return;
    const project = await this.prisma.project.findFirst({
      where: tenantWhere(tenantId, { id }),
      select: { id: true },
    });
    if (!project) throw new BadRequestException('El proyecto no pertenece a la empresa');
  }

  private async assertShift(tenantId: string, id?: string | null) {
    if (!id) return;
    const shift = await this.prisma.shift.findFirst({
      where: tenantWhere(tenantId, { id }),
      select: { id: true },
    });
    if (!shift) throw new BadRequestException('El turno no pertenece a la empresa');
  }

  private async assertEmployee(tenantId: string, id?: string | null) {
    if (!id) return;
    const employee = await this.prisma.employee.findFirst({
      where: tenantWhere(tenantId, { id }),
      select: { id: true },
    });
    if (!employee) throw new BadRequestException('El supervisor no pertenece a la empresa');
  }
}
