import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmployeeStatus, EmploymentType, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employees.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.crewId) where.crewId = query.crewId;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.company) where.company = query.company;
    if (query.search) {
      const contains = { contains: String(query.search), mode: 'insensitive' };
      where.OR = [
        { code: contains },
        { firstName: contains },
        { lastName: contains },
        { documentNumber: contains },
        { email: contains },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, code: true, name: true } },
          crew: { select: { id: true, code: true, name: true } },
          shift: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.employee.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async stats(tenantId: string, query: Record<string, any> = {}) {
    const where: Record<string, any> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.crewId) where.crewId = query.crewId;

    const [total, byType, byStatus] = await Promise.all([
      this.prisma.employee.count({ where: tenantWhere(tenantId, where) }),
      this.prisma.employee.groupBy({
        by: ['type'],
        where: tenantWhere(tenantId, where),
        _count: { _all: true },
      }),
      this.prisma.employee.groupBy({
        by: ['status'],
        where: tenantWhere(tenantId, where),
        _count: { _all: true },
      }),
    ]);

    const typeCounts: Record<string, number> = {};
    for (const type of Object.values(EmploymentType)) typeCounts[type] = 0;
    for (const row of byType) typeCounts[row.type] = row._count._all;

    const statusCounts: Record<string, number> = {};
    for (const status of Object.values(EmployeeStatus)) statusCounts[status] = 0;
    for (const row of byStatus) statusCounts[row.status] = row._count._all;

    return { total, byType: typeCounts, byStatus: statusCounts };
  }

  async findOne(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        project: { select: { id: true, code: true, name: true } },
        crew: { select: { id: true, code: true, name: true } },
        shift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
        assignments: {
          select: { id: true, equipmentId: true, status: true, startDate: true, endDate: true },
        },
      },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    return employee;
  }

  async create(tenantId: string, dto: CreateEmployeeDto, actorId: string) {
    await this.assertFks(tenantId, dto.projectId, dto.crewId, dto.shiftId);

    const employee = await this.prisma.employee.create({
      data: tenantData(tenantId, {
        projectId: dto.projectId || null,
        crewId: dto.crewId || null,
        shiftId: dto.shiftId || null,
        code: dto.code.trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        documentType: dto.documentType || 'DNI',
        documentNumber: dto.documentNumber.trim(),
        email: dto.email?.toLowerCase().trim(),
        phone: dto.phone,
        position: dto.position.trim(),
        company: dto.company,
        type: dto.type || EmploymentType.EMPLOYEE,
        status: dto.status || EmployeeStatus.ACTIVE,
        hiredAt: this.parseDate(dto.hiredAt, 'hiredAt'),
        documents: dto.documents ?? undefined,
      }) as Prisma.EmployeeUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Employee',
      entityId: employee.id,
      after: dto,
    });
    return this.findOne(tenantId, employee.id);
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto, actorId: string) {
    await this.findOne(tenantId, id);
    await this.assertFks(tenantId, dto.projectId, dto.crewId, dto.shiftId);

    const data: Record<string, any> = {};
    const fields = [
      'projectId',
      'crewId',
      'shiftId',
      'code',
      'firstName',
      'lastName',
      'documentType',
      'documentNumber',
      'email',
      'phone',
      'position',
      'company',
      'type',
      'status',
      'documents',
    ] as const;
    for (const field of fields) {
      if (dto[field] === undefined) continue;
      data[field] = field === 'email' && dto[field] ? String(dto[field]).toLowerCase().trim() : dto[field];
    }
    if (dto.hiredAt !== undefined) data.hiredAt = this.parseDate(dto.hiredAt, 'hiredAt');

    await this.prisma.employee.updateMany({ where: tenantWhere(tenantId, { id }), data });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Employee',
      entityId: id,
      after: dto,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    await this.findOne(tenantId, id);
    await this.prisma.employee.deleteMany({ where: tenantWhere(tenantId, { id }) });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Employee',
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

  private async assertFks(
    tenantId: string,
    projectId?: string | null,
    crewId?: string | null,
    shiftId?: string | null,
  ) {
    if (projectId) await this.exists('project', tenantId, projectId, 'El proyecto no pertenece a la empresa');
    if (crewId) await this.exists('crew', tenantId, crewId, 'La cuadrilla no pertenece a la empresa');
    if (shiftId) await this.exists('shift', tenantId, shiftId, 'El turno no pertenece a la empresa');
  }

  private async exists(
    model: 'project' | 'crew' | 'shift',
    tenantId: string,
    id: string,
    message: string,
  ) {
    const where = tenantWhere(tenantId, { id });
    let record: { id: string } | null = null;
    if (model === 'project') {
      record = await this.prisma.project.findFirst({ where, select: { id: true } });
    } else if (model === 'crew') {
      record = await this.prisma.crew.findFirst({ where, select: { id: true } });
    } else {
      record = await this.prisma.shift.findFirst({ where, select: { id: true } });
    }
    if (!record) throw new BadRequestException(message);
  }
}
