import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, ProjectStatus } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.status) where.status = query.status;
    if (query.managerId) where.managerId = query.managerId;
    if (query.search) {
      where.OR = [
        { code: { contains: String(query.search), mode: 'insensitive' } },
        { name: { contains: String(query.search), mode: 'insensitive' } },
        { description: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          manager: { select: { id: true, code: true, firstName: true, lastName: true } },
          _count: { select: { mines: true, employees: true, equipment: true, reports: true } },
        },
      }),
      this.prisma.project.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        manager: { select: { id: true, code: true, firstName: true, lastName: true } },
        _count: { select: { mines: true, shifts: true, crews: true, employees: true, equipment: true, reports: true } },
      },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async findMines(tenantId: string, id: string, query: Record<string, any>) {
    await this.findOne(tenantId, id);
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = { projectId: id };
    if (query.status) where.status = query.status;
    if (query.mode) where.mode = query.mode;
    if (query.search) {
      where.OR = [
        { code: { contains: String(query.search), mode: 'insensitive' } },
        { name: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.mine.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { areas: true, reports: true } } },
      }),
      this.prisma.mine.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async stats(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const [mines, employees, equipment, reports] = await Promise.all([
      this.prisma.mine.count({ where: tenantWhere(tenantId, { projectId: id }) }),
      this.prisma.employee.count({ where: tenantWhere(tenantId, { projectId: id }) }),
      this.prisma.equipment.count({ where: tenantWhere(tenantId, { projectId: id }) }),
      this.prisma.operationReport.count({ where: tenantWhere(tenantId, { projectId: id }) }),
    ]);
    return { projectId: id, mines, employees, equipment, reports };
  }

  async create(tenantId: string, dto: CreateProjectDto, actorId: string) {
    await this.assertEmployee(tenantId, dto.managerId);
    const project = await this.prisma.project.create({
      data: tenantData(tenantId, {
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description,
        status: dto.status || ProjectStatus.PLANNED,
        startDate: this.parseDate(dto.startDate, 'startDate'),
        endDate: this.parseDate(dto.endDate, 'endDate'),
        managerId: dto.managerId || null,
      }) as Prisma.ProjectUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Project',
      entityId: project.id,
      after: dto,
    });
    return this.findOne(tenantId, project.id);
  }

  async update(tenantId: string, id: string, dto: UpdateProjectDto, actorId: string) {
    await this.findOne(tenantId, id);
    await this.assertEmployee(tenantId, dto.managerId);

    const data: Record<string, any> = {};
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startDate !== undefined) data.startDate = this.parseDate(dto.startDate, 'startDate');
    if (dto.endDate !== undefined) data.endDate = this.parseDate(dto.endDate, 'endDate');
    if (dto.managerId !== undefined) data.managerId = dto.managerId;

    await this.prisma.project.updateMany({ where: tenantWhere(tenantId, { id }), data });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Project',
      entityId: id,
      after: dto,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    await this.findOne(tenantId, id);
    await this.prisma.project.deleteMany({ where: tenantWhere(tenantId, { id }) });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Project',
      entityId: id,
    });
    return { success: true };
  }

  private parseDate(value: string | null | undefined, field: string): Date | null {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} no es una fecha válida`);
    return date;
  }

  private async assertEmployee(tenantId: string, id?: string | null) {
    if (!id) return;
    const employee = await this.prisma.employee.findFirst({
      where: tenantWhere(tenantId, { id }),
      select: { id: true },
    });
    if (!employee) throw new BadRequestException('El responsable no pertenece a la empresa');
  }
}
