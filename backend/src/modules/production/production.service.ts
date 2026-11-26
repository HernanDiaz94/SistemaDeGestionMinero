import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ProductionCategory } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import {
  aggregateByIndicator,
  buildReportWhere,
  compareWithTargets,
  fetchApprovedProduction,
  fetchTargets,
} from '../analytics/analytics-aggregation.helper';
import {
  CreateProductionIndicatorDto,
  CreateProductionTargetDto,
  CreateProductionUnitDto,
  UpdateProductionIndicatorDto,
  UpdateProductionTargetDto,
  UpdateProductionUnitDto,
} from './dto/production.dto';

/** Adaptador tipado para los inputs create de Prisma. */
const scopedData = (tenantId: string, data: Record<string, any>): any =>
  tenantData(tenantId, data);

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Unidades de producción
  // ---------------------------------------------------------------------------

  async findAllUnits(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = tenantWhere(tenantId);
    if (query.category) where.category = query.category;
    if (query.active !== undefined) where.active = query.active === 'true' || query.active === true;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { symbol: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.productionUnit.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.productionUnit.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  /** Unidades de una categoría para validar compatibilidad desde el frontend. */
  async compatibleUnits(tenantId: string, category?: string) {
    if (category && !Object.values(ProductionCategory).includes(category as ProductionCategory)) {
      throw new BadRequestException(`Categoría no válida: ${category}`);
    }
    return this.prisma.productionUnit.findMany({
      where: tenantWhere(tenantId, {
        ...(category ? { category: category as ProductionCategory } : {}),
      }),
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        symbol: true,
        category: true,
        factorToBaseUnit: true,
        active: true,
      },
    });
  }

  async findOneUnit(tenantId: string, id: string) {
    const unit = await this.prisma.productionUnit.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: { _count: { select: { indicators: true, records: true } } },
    });
    if (!unit) throw new NotFoundException('Unidad de producción no encontrada');
    return unit;
  }

  async createUnit(
    tenantId: string,
    dto: CreateProductionUnitDto,
    actorId: string,
  ) {
    await this.assertUnitCode(tenantId, dto.code);
    const unit = await this.prisma.productionUnit.create({
      data: scopedData(tenantId, {
        code: dto.code,
        name: dto.name,
        symbol: dto.symbol,
        category: dto.category,
        factorToBaseUnit: dto.factorToBaseUnit ?? 1,
        active: dto.active ?? true,
      }),
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'ProductionUnit',
      entityId: unit.id,
      after: this.asJson(unit),
    });
    return unit;
  }

  async updateUnit(
    tenantId: string,
    id: string,
    dto: UpdateProductionUnitDto,
    actorId: string,
  ) {
    const existing = await this.findOneUnit(tenantId, id);
    if (dto.code && dto.code !== existing.code) await this.assertUnitCode(tenantId, dto.code, id);
    const unit = await this.prisma.productionUnit.update({
      where: { id },
      data: scopedData(tenantId, {
        code: dto.code ?? existing.code,
        name: dto.name ?? existing.name,
        symbol: dto.symbol ?? existing.symbol,
        category: dto.category ?? existing.category,
        factorToBaseUnit: dto.factorToBaseUnit ?? existing.factorToBaseUnit,
        active: dto.active ?? existing.active,
      }),
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionUnit',
      entityId: id,
      before: this.asJson(existing),
      after: this.asJson(unit),
    });
    return unit;
  }

  async removeUnit(tenantId: string, id: string, actorId: string) {
    await this.findOneUnit(tenantId, id);
    const [indicators, records] = await Promise.all([
      this.prisma.productionIndicator.count({ where: tenantWhere(tenantId, { unitId: id }) }),
      this.prisma.productionRecord.count({ where: tenantWhere(tenantId, { unitId: id }) }),
    ]);
    if (indicators || records) {
      throw new BadRequestException(
        'No se puede eliminar una unidad usada por indicadores o registros de producción',
      );
    }
    await this.prisma.productionUnit.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'ProductionUnit',
      entityId: id,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Indicadores de producción
  // ---------------------------------------------------------------------------

  async findAllIndicators(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = tenantWhere(tenantId);
    if (query.unitId) where.unitId = query.unitId;
    if (query.category) where.category = query.category;
    if (query.active !== undefined) where.active = query.active === 'true' || query.active === true;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.productionIndicator.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
        include: {
          unit: {
            select: {
              id: true,
              code: true,
              name: true,
              symbol: true,
              category: true,
              factorToBaseUnit: true,
            },
          },
        },
      }),
      this.prisma.productionIndicator.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOneIndicator(tenantId: string, id: string) {
    const indicator = await this.prisma.productionIndicator.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        unit: true,
        _count: { select: { records: true, targets: true } },
      },
    });
    if (!indicator) throw new NotFoundException('Indicador de producción no encontrado');
    return indicator;
  }

  async createIndicator(
    tenantId: string,
    dto: CreateProductionIndicatorDto,
    actorId: string,
  ) {
    const unit = await this.prisma.productionUnit.findFirst({
      where: tenantWhere(tenantId, { id: dto.unitId }),
    });
    if (!unit) throw new BadRequestException('Unidad de producción no encontrada');
    if (unit.category !== dto.category) {
      throw new BadRequestException('La categoría del indicador debe coincidir con la de la unidad');
    }
    await this.assertIndicatorCode(tenantId, dto.code);
    const indicator = await this.prisma.productionIndicator.create({
      data: scopedData(tenantId, {
        unitId: dto.unitId,
        code: dto.code,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        active: dto.active ?? true,
      }),
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'ProductionIndicator',
      entityId: indicator.id,
      after: this.asJson(indicator),
    });
    return indicator;
  }

  async updateIndicator(
    tenantId: string,
    id: string,
    dto: UpdateProductionIndicatorDto,
    actorId: string,
  ) {
    const existing = await this.findOneIndicator(tenantId, id);
    const unitId = dto.unitId ?? existing.unitId;
    const category = dto.category ?? existing.category;
    const unit = await this.prisma.productionUnit.findFirst({
      where: tenantWhere(tenantId, { id: unitId }),
    });
    if (!unit) throw new BadRequestException('Unidad de producción no encontrada');
    if (unit.category !== category) {
      throw new BadRequestException('La categoría del indicador debe coincidir con la de la unidad');
    }
    if (dto.code && dto.code !== existing.code) {
      await this.assertIndicatorCode(tenantId, dto.code, id);
    }
    const indicator = await this.prisma.productionIndicator.update({
      where: { id },
      data: scopedData(tenantId, {
        unitId,
        code: dto.code ?? existing.code,
        name: dto.name ?? existing.name,
        category,
        description: dto.description !== undefined ? dto.description : existing.description,
        active: dto.active ?? existing.active,
      }),
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionIndicator',
      entityId: id,
      before: this.asJson(existing),
      after: this.asJson(indicator),
    });
    return indicator;
  }

  async removeIndicator(tenantId: string, id: string, actorId: string) {
    await this.findOneIndicator(tenantId, id);
    const [records, targets] = await Promise.all([
      this.prisma.productionRecord.count({ where: tenantWhere(tenantId, { indicatorId: id }) }),
      this.prisma.productionTarget.count({ where: tenantWhere(tenantId, { indicatorId: id }) }),
    ]);
    if (records || targets) {
      throw new BadRequestException(
        'No se puede eliminar un indicador usado por registros u objetivos',
      );
    }
    await this.prisma.productionIndicator.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'ProductionIndicator',
      entityId: id,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Objetivos de producción
  // ---------------------------------------------------------------------------

  async findAllTargets(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = tenantWhere(tenantId);
    if (query.projectId) where.projectId = query.projectId;
    if (query.mineId) where.mineId = query.mineId;
    if (query.areaId) where.areaId = query.areaId;
    if (query.indicatorId) where.indicatorId = query.indicatorId;
    if (query.period) where.period = query.period;
    if (query.year) where.year = Number(query.year);
    const [items, total] = await Promise.all([
      this.prisma.productionTarget.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, code: true, name: true } },
          mine: { select: { id: true, code: true, name: true } },
          area: { select: { id: true, code: true, name: true } },
          indicator: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: { select: { id: true, code: true, symbol: true } },
            },
          },
        },
      }),
      this.prisma.productionTarget.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOneTarget(tenantId: string, id: string) {
    const target = await this.prisma.productionTarget.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        project: { select: { id: true, code: true, name: true } },
        mine: { select: { id: true, code: true, name: true } },
        area: { select: { id: true, code: true, name: true } },
        indicator: { include: { unit: true } },
      },
    });
    if (!target) throw new NotFoundException('Objetivo de producción no encontrado');
    return target;
  }

  async createTarget(
    tenantId: string,
    dto: CreateProductionTargetDto,
    actorId: string,
  ) {
    await this.validateTargetScope(tenantId, dto);
    const target = await this.prisma.productionTarget.create({
      data: scopedData(tenantId, {
        projectId: dto.projectId,
        mineId: dto.mineId || null,
        areaId: dto.areaId || null,
        indicatorId: dto.indicatorId,
        period: dto.period,
        year: dto.year,
        month: dto.month ?? null,
        day: dto.day ?? null,
        targetValue: dto.targetValue,
        createdByUserId: actorId,
      }),
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'ProductionTarget',
      entityId: target.id,
      after: this.asJson(target),
    });
    return this.findOneTarget(tenantId, target.id);
  }

  async updateTarget(
    tenantId: string,
    id: string,
    dto: UpdateProductionTargetDto,
    actorId: string,
  ) {
    const existing = await this.findOneTarget(tenantId, id);
    await this.validateTargetScope(tenantId, {
      projectId: dto.projectId ?? existing.projectId,
      mineId: dto.mineId !== undefined ? dto.mineId : existing.mineId,
      areaId: dto.areaId !== undefined ? dto.areaId : existing.areaId,
      indicatorId: dto.indicatorId ?? existing.indicatorId,
    });
    const target = await this.prisma.productionTarget.update({
      where: { id },
      data: scopedData(tenantId, {
        projectId: dto.projectId ?? existing.projectId,
        mineId: dto.mineId !== undefined ? dto.mineId : existing.mineId,
        areaId: dto.areaId !== undefined ? dto.areaId : existing.areaId,
        indicatorId: dto.indicatorId ?? existing.indicatorId,
        period: dto.period ?? existing.period,
        year: dto.year ?? existing.year,
        month: dto.month !== undefined ? dto.month : existing.month,
        day: dto.day !== undefined ? dto.day : existing.day,
        targetValue: dto.targetValue ?? existing.targetValue,
      }),
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'ProductionTarget',
      entityId: id,
      before: this.asJson(existing),
      after: this.asJson(target),
    });
    return this.findOneTarget(tenantId, id);
  }

  async removeTarget(tenantId: string, id: string, actorId: string) {
    await this.findOneTarget(tenantId, id);
    await this.prisma.productionTarget.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'ProductionTarget',
      entityId: id,
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Registros y resumen
  // ---------------------------------------------------------------------------

  async findAllRecords(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = tenantWhere(tenantId);
    if (query.indicatorId) where.indicatorId = query.indicatorId;
    if (query.reportId) where.reportId = query.reportId;
    where.report = buildReportWhere(tenantId, query);

    const [items, total] = await Promise.all([
      this.prisma.productionRecord.findMany({
        where,
        skip,
        take,
        orderBy: { report: { date: 'desc' } },
        include: {
          indicator: {
            select: { id: true, code: true, name: true, category: true },
          },
          unit: {
            select: {
              id: true,
              code: true,
              name: true,
              symbol: true,
              category: true,
              factorToBaseUnit: true,
            },
          },
          report: {
            select: {
              id: true,
              code: true,
              date: true,
              status: true,
              project: { select: { id: true, code: true, name: true } },
              mine: { select: { id: true, code: true, name: true } },
              shift: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.productionRecord.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  /** Totales por indicador SOLO de reportes aprobados, en unidad base. */
  async summary(tenantId: string, query: Record<string, any>) {
    const rows = await fetchApprovedProduction(this.prisma, tenantId, query);
    const aggregated = aggregateByIndicator(rows);
    const targets = await fetchTargets(this.prisma, tenantId, query);
    const comparison = compareWithTargets(aggregated, targets, query.from, query.to);

    const indicatorUnits = new Map(rows.map((row) => [row.indicatorId, row.indicator.unit]));
    const data = comparison.map((entry, index) => {
      const unit = indicatorUnits.get(entry.indicatorId);
      return {
        ...entry,
        category: rows.find((row) => row.indicatorId === entry.indicatorId)?.indicator.category,
        records: aggregated[index]?.records || 0,
        rawValue: aggregated[index]?.rawValue || 0,
        unit: unit
          ? { id: unit.id, code: unit.code, symbol: unit.symbol }
          : entry.unit,
      };
    });
    return {
      data,
      meta: {
        records: rows.length,
        indicators: data.length,
        onlyApproved: true,
      },
    };
  }

  private async validateTargetScope(
    tenantId: string,
    scope: {
      projectId: string;
      mineId?: string | null;
      areaId?: string | null;
      indicatorId: string;
    },
  ) {
    const project = await this.prisma.project.findFirst({
      where: tenantWhere(tenantId, { id: scope.projectId }),
      select: { id: true },
    });
    if (!project) throw new BadRequestException('Proyecto no encontrado para la empresa');

    if (scope.mineId) {
      const mine = await this.prisma.mine.findFirst({
        where: tenantWhere(tenantId, { id: scope.mineId, projectId: scope.projectId }),
        select: { id: true },
      });
      if (!mine) throw new BadRequestException('El yacimiento no pertenece al proyecto');
    }
    if (scope.areaId) {
      const area = await this.prisma.mineArea.findFirst({
        where: tenantWhere(tenantId, {
          id: scope.areaId,
          ...(scope.mineId ? { mineId: scope.mineId } : {}),
        }),
        select: { id: true },
      });
      if (!area) throw new BadRequestException('El sector no pertenece al yacimiento');
    }
    const indicator = await this.prisma.productionIndicator.findFirst({
      where: tenantWhere(tenantId, { id: scope.indicatorId }),
      select: { id: true },
    });
    if (!indicator) throw new BadRequestException('Indicador no encontrado para la empresa');
  }

  private async assertUnitCode(tenantId: string, code: string, excludeId?: string) {
    const existing = await this.prisma.productionUnit.findFirst({
      where: tenantWhere(tenantId, { code, ...(excludeId ? { id: { not: excludeId } } : {}) }),
      select: { id: true },
    });
    if (existing) throw new BadRequestException(`El código de unidad ${code} ya existe`);
  }

  private async assertIndicatorCode(tenantId: string, code: string, excludeId?: string) {
    const existing = await this.prisma.productionIndicator.findFirst({
      where: tenantWhere(tenantId, { code, ...(excludeId ? { id: { not: excludeId } } : {}) }),
      select: { id: true },
    });
    if (existing) throw new BadRequestException(`El código de indicador ${code} ya existe`);
  }

  private asJson(value: any) {
    return JSON.parse(JSON.stringify(value ?? null));
  }
}
