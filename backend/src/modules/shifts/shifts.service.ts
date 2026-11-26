import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmployeeStatus, Prisma, ShiftType } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import { CreateShiftDto, UpdateShiftDto } from './dto/shifts.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { code: { contains: String(query.search), mode: 'insensitive' } },
        { name: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.shift.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, code: true, name: true } },
          _count: { select: { crews: true, employees: true, reports: true } },
        },
      }),
      this.prisma.shift.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const shift = await this.prisma.shift.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        project: { select: { id: true, code: true, name: true } },
        _count: { select: { crews: true, employees: true, reports: true } },
      },
    });
    if (!shift) throw new NotFoundException('Turno no encontrado');
    return shift;
  }

  async create(tenantId: string, dto: CreateShiftDto, actorId: string) {
    await this.assertProject(tenantId, dto.projectId);
    this.assertTime(dto.startTime, 'startTime');
    this.assertTime(dto.endTime, 'endTime');

    const shift = await this.prisma.shift.create({
      data: tenantData(tenantId, {
        projectId: dto.projectId || null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        type: dto.type || ShiftType.DAY,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: dto.status || EmployeeStatus.ACTIVE,
      }) as Prisma.ShiftUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Shift',
      entityId: shift.id,
      after: dto,
    });
    return this.findOne(tenantId, shift.id);
  }

  async update(tenantId: string, id: string, dto: UpdateShiftDto, actorId: string) {
    await this.findOne(tenantId, id);
    await this.assertProject(tenantId, dto.projectId);
    if (dto.startTime !== undefined) this.assertTime(dto.startTime, 'startTime');
    if (dto.endTime !== undefined) this.assertTime(dto.endTime, 'endTime');

    const data: Record<string, any> = {};
    if (dto.projectId !== undefined) data.projectId = dto.projectId;
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.startTime !== undefined) data.startTime = dto.startTime;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;
    if (dto.status !== undefined) data.status = dto.status;

    await this.prisma.shift.updateMany({ where: tenantWhere(tenantId, { id }), data });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Shift',
      entityId: id,
      after: dto,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    await this.findOne(tenantId, id);
    await this.prisma.shift.deleteMany({ where: tenantWhere(tenantId, { id }) });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Shift',
      entityId: id,
    });
    return { success: true };
  }

  private assertTime(value: string, field: string) {
    if (!TIME_PATTERN.test(value)) {
      throw new BadRequestException(`${field} debe tener formato HH:mm`);
    }
  }

  private async assertProject(tenantId: string, id?: string | null) {
    if (!id) return;
    const project = await this.prisma.project.findFirst({
      where: tenantWhere(tenantId, { id }),
      select: { id: true },
    });
    if (!project) throw new BadRequestException('El proyecto no pertenece a la empresa');
  }
}
