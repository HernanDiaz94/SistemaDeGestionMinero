import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EquipmentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import {
  CreateEquipmentCategoryDto,
  CreateEquipmentDto,
  CreateEquipmentReadingDto,
  CreateFuelRecordDto,
  UpdateEquipmentCategoryDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Categorías
  // ---------------------------------------------------------------------------

  async findAllCategories(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.search) {
      where.OR = [
        { code: { contains: String(query.search), mode: 'insensitive' } },
        { name: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.equipmentCategory.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { equipment: true } } },
      }),
      this.prisma.equipmentCategory.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOneCategory(tenantId: string, id: string) {
    const category = await this.prisma.equipmentCategory.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: { _count: { select: { equipment: true } } },
    });
    if (!category) throw new NotFoundException('Categoría de equipo no encontrada');
    return category;
  }

  async createCategory(
    tenantId: string,
    dto: CreateEquipmentCategoryDto,
    actorId: string,
  ) {
    const category = await this.prisma.equipmentCategory.create({
      data: tenantData(tenantId, {
        code: dto.code.trim(),
        name: dto.name.trim(),
        description: dto.description,
      }) as Prisma.EquipmentCategoryUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'EquipmentCategory',
      entityId: category.id,
      after: dto,
    });
    return this.findOneCategory(tenantId, category.id);
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdateEquipmentCategoryDto,
    actorId: string,
  ) {
    await this.findOneCategory(tenantId, id);
    const data: Record<string, any> = {};
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description;

    await this.prisma.equipmentCategory.updateMany({
      where: tenantWhere(tenantId, { id }),
      data,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'EquipmentCategory',
      entityId: id,
      after: dto,
    });
    return this.findOneCategory(tenantId, id);
  }

  async removeCategory(tenantId: string, id: string, actorId: string) {
    await this.findOneCategory(tenantId, id);
    const used = await this.prisma.equipment.count({
      where: tenantWhere(tenantId, { categoryId: id }),
    });
    if (used > 0) throw new BadRequestException('La categoría tiene equipos asociados');
    await this.prisma.equipmentCategory.deleteMany({
      where: tenantWhere(tenantId, { id }),
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'EquipmentCategory',
      entityId: id,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Equipos
  // ---------------------------------------------------------------------------

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.responsibleId) where.responsibleId = query.responsibleId;
    if (query.status) where.status = query.status;
    if (query.search) {
      const contains = { contains: String(query.search), mode: 'insensitive' };
      where.OR = [
        { code: contains },
        { name: contains },
        { brand: contains },
        { model: contains },
        { serialNumber: contains },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.equipment.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, code: true, name: true } },
          project: { select: { id: true, code: true, name: true } },
          responsible: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.equipment.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async stats(tenantId: string, query: Record<string, any> = {}) {
    const where: Record<string, any> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.categoryId) where.categoryId = query.categoryId;

    const [total, grouped] = await Promise.all([
      this.prisma.equipment.count({ where: tenantWhere(tenantId, where) }),
      this.prisma.equipment.groupBy({
        by: ['status'],
        where: tenantWhere(tenantId, where),
        _count: { _all: true },
      }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const status of Object.values(EquipmentStatus)) byStatus[status] = 0;
    for (const row of grouped) byStatus[row.status] = row._count._all;
    return { total, byStatus };
  }

  async findOne(tenantId: string, id: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        category: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
        responsible: {
          select: { id: true, code: true, firstName: true, lastName: true },
        },
        _count: { select: { readings: true, fuelRecords: true, assignments: true } },
      },
    });
    if (!equipment) throw new NotFoundException('Equipo no encontrado');
    return equipment;
  }

  async create(tenantId: string, dto: CreateEquipmentDto, actorId: string) {
    await this.assertFks(tenantId, dto.categoryId, dto.projectId, dto.responsibleId);
    const equipment = await this.prisma.equipment.create({
      data: tenantData(tenantId, {
        categoryId: dto.categoryId || null,
        projectId: dto.projectId || null,
        responsibleId: dto.responsibleId || null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        brand: dto.brand,
        model: dto.model,
        serialNumber: dto.serialNumber,
        status: dto.status || EquipmentStatus.OPERATIONAL,
        operatingHours: this.decimal(dto.operatingHours ?? 0, 'operatingHours'),
        purchaseDate: this.parseNullableDate(dto.purchaseDate, 'purchaseDate'),
        notes: dto.notes,
      }) as Prisma.EquipmentUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Equipment',
      entityId: equipment.id,
      after: dto,
    });
    return this.findOne(tenantId, equipment.id);
  }

  async update(tenantId: string, id: string, dto: UpdateEquipmentDto, actorId: string) {
    await this.findOne(tenantId, id);
    await this.assertFks(tenantId, dto.categoryId, dto.projectId, dto.responsibleId);

    const data: Record<string, any> = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.projectId !== undefined) data.projectId = dto.projectId;
    if (dto.responsibleId !== undefined) data.responsibleId = dto.responsibleId;
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.brand !== undefined) data.brand = dto.brand;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.serialNumber !== undefined) data.serialNumber = dto.serialNumber;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.operatingHours !== undefined) {
      data.operatingHours = this.decimal(dto.operatingHours, 'operatingHours');
    }
    if (dto.purchaseDate !== undefined) {
      data.purchaseDate = this.parseNullableDate(dto.purchaseDate, 'purchaseDate');
    }
    if (dto.notes !== undefined) data.notes = dto.notes;

    await this.prisma.equipment.updateMany({ where: tenantWhere(tenantId, { id }), data });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Equipment',
      entityId: id,
      after: dto,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    await this.findOne(tenantId, id);
    await this.prisma.equipment.deleteMany({ where: tenantWhere(tenantId, { id }) });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Equipment',
      entityId: id,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Lecturas de horómetro
  // ---------------------------------------------------------------------------

  async findReadings(tenantId: string, id: string, query: Record<string, any>) {
    await this.findOne(tenantId, id);
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = { equipmentId: id };
    if (query.from || query.to) {
      where.readAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.equipmentReading.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { readAt: 'desc' },
        include: {
          recordedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.equipmentReading.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createReading(
    tenantId: string,
    id: string,
    dto: CreateEquipmentReadingDto,
    actorId: string,
  ) {
    await this.findOne(tenantId, id);
    const hours = this.decimal(dto.hours, 'hours');
    const readAt = dto.readAt ? this.parseDate(dto.readAt, 'readAt') : new Date();
    if (Number.isNaN(readAt.getTime())) throw new BadRequestException('readAt no es una fecha válida');

    const reading = await this.prisma.$transaction(async (tx) => {
      const created = await tx.equipmentReading.create({
        data: tenantData(tenantId, {
          equipmentId: id,
          readAt,
          hours,
          recordedByUserId: actorId,
          notes: dto.notes,
        }) as Prisma.EquipmentReadingUncheckedCreateInput,
      });
      await tx.equipment.updateMany({
        where: tenantWhere(tenantId, { id }),
        data: { operatingHours: hours },
      });
      return created;
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'EquipmentReading',
      entityId: reading.id,
      after: { ...dto, equipmentId: id },
    });
    return reading;
  }

  // ---------------------------------------------------------------------------
  // Combustible
  // ---------------------------------------------------------------------------

  async findFuel(tenantId: string, id: string, query: Record<string, any>) {
    await this.findOne(tenantId, id);
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = { equipmentId: id };
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.fuelRecord.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          recordedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.fuelRecord.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createFuel(
    tenantId: string,
    id: string,
    dto: CreateFuelRecordDto,
    actorId: string,
  ) {
    await this.findOne(tenantId, id);
    const record = await this.prisma.fuelRecord.create({
      data: tenantData(tenantId, {
        equipmentId: id,
        date: dto.date ? this.parseDate(dto.date, 'date') : new Date(),
        liters: this.decimal(dto.liters, 'liters'),
        cost: dto.cost === undefined ? null : this.decimal(dto.cost, 'cost'),
        station: dto.station,
        recordedByUserId: actorId,
        notes: dto.notes,
      }) as Prisma.FuelRecordUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'FuelRecord',
      entityId: record.id,
      after: { ...dto, equipmentId: id },
    });
    return record;
  }

  private decimal(value: number | null | undefined, field: string): number {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${field} es obligatorio`);
    }
    const number = Number(value);
    if (!Number.isFinite(number)) throw new BadRequestException(`${field} no es válido`);
    return number;
  }

  private parseDate(value: string | null | undefined, field: string): Date {
    if (!value) {
      const date = new Date();
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException(`${field} no es una fecha válida`);
      }
      return date;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} no es una fecha válida`);
    }
    return date;
  }

  private parseNullableDate(value: string | null | undefined, field: string): Date | null {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} no es una fecha válida`);
    }
    return date;
  }

  private async assertFks(
    tenantId: string,
    categoryId?: string | null,
    projectId?: string | null,
    responsibleId?: string | null,
  ) {
    if (categoryId) {
      await this.exists('equipmentCategory', tenantId, categoryId, 'La categoría no pertenece a la empresa');
    }
    if (projectId) {
      await this.exists('project', tenantId, projectId, 'El proyecto no pertenece a la empresa');
    }
    if (responsibleId) {
      await this.exists('employee', tenantId, responsibleId, 'El responsable no pertenece a la empresa');
    }
  }

  private async exists(
    model: 'equipmentCategory' | 'project' | 'employee',
    tenantId: string,
    id: string,
    message: string,
  ) {
    const where = tenantWhere(tenantId, { id });
    let record: { id: string } | null = null;
    if (model === 'equipmentCategory') {
      record = await this.prisma.equipmentCategory.findFirst({ where, select: { id: true } });
    } else if (model === 'project') {
      record = await this.prisma.project.findFirst({ where, select: { id: true } });
    } else {
      record = await this.prisma.employee.findFirst({ where, select: { id: true } });
    }
    if (!record) throw new BadRequestException(message);
  }
}
