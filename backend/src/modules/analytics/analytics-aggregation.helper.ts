import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWhere } from '../../common/tenant/tenant-scope';

/**
 * Helper compartido de agregación. Todas las consultas de producción
 * (analytics, dashboard y producción) pasan por aquí para no repetir filtros
 * y para garantizar que solo se contabilicen reportes APROBADOS.
 */

export interface ProductionFilters {
  from?: string | Date;
  to?: string | Date;
  projectId?: string;
  mineId?: string;
  areaId?: string;
  shiftId?: string;
  indicatorId?: string;
  reportId?: string;
  status?: string;
  search?: string;
}

export interface ProductionRow {
  id: string;
  value: any;
  indicatorId: string;
  reportId: string;
  indicator: {
    id: string;
    code: string;
    name: string;
    category: string;
    unitId: string;
    unit: {
      id: string;
      code: string;
      name: string;
      symbol: string;
      category: string;
      factorToBaseUnit: any;
    };
  };
  unit: {
    id: string;
    code: string;
    name: string;
    symbol: string;
    category: string;
    factorToBaseUnit: any;
  };
  report: {
    id: string;
    code: string;
    date: Date;
    projectId: string;
    mineId: string;
    areaId: string | null;
    shiftId: string;
    project: { id: string; code: string; name: string };
    mine: { id: string; code: string; name: string };
    area: { id: string; code: string; name: string } | null;
    shift: { id: string; code: string; name: string };
  };
}

export interface AggregatedProduction {
  key: string;
  label: string;
  records: number;
  /** Suma de los valores en la unidad capturada (puede mezclar unidades). */
  rawValue: number;
  /** Suma convertida a unidad base usando factorToBaseUnit. */
  baseValue: number;
  byIndicator: Record<string, number>;
}

export function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  const unwrapped =
    typeof value === 'object' && typeof value.toNumber === 'function'
      ? value.toNumber()
      : value;
  const parsed = Number(unwrapped);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeDate(value?: string | Date): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Construye el where de OperationReport ya limitado al tenant. */
export function buildReportWhere(
  tenantId: string,
  filters: ProductionFilters = {},
  statusOverride?: string | string[],
): Record<string, any> {
  const where: Record<string, any> = tenantWhere(tenantId);
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.mineId) where.mineId = filters.mineId;
  if (filters.areaId) where.areaId = filters.areaId;
  if (filters.shiftId) where.shiftId = filters.shiftId;
  if (filters.reportId) where.id = filters.reportId;

  const from = normalizeDate(filters.from);
  const to = normalizeDate(filters.to);
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  if (statusOverride !== undefined) where.status = statusOverride;
  else if (filters.status) where.status = filters.status;
  return where;
}

/** Producción aprobada del tenant, con indicador, unidad y reporte. */
export async function fetchApprovedProduction(
  prisma: PrismaService,
  tenantId: string,
  filters: ProductionFilters = {},
): Promise<ProductionRow[]> {
  const where: Record<string, any> = tenantWhere(tenantId);
  if (filters.indicatorId) where.indicatorId = filters.indicatorId;
  if (filters.reportId) where.reportId = filters.reportId;
  where.report = buildReportWhere(tenantId, filters, 'APPROVED');

  return prisma.productionRecord.findMany({
    where,
    select: {
      id: true,
      value: true,
      indicatorId: true,
      reportId: true,
      indicator: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          unitId: true,
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
          projectId: true,
          mineId: true,
          areaId: true,
          shiftId: true,
          project: { select: { id: true, code: true, name: true } },
          mine: { select: { id: true, code: true, name: true } },
          area: { select: { id: true, code: true, name: true } },
          shift: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { report: { date: 'asc' } },
  }) as unknown as Promise<ProductionRow[]>;
}

/** Factor de conversión de la unidad realmente capturada en el registro. */
export function rowFactor(row: ProductionRow): number {
  const factor = toNumber(row.unit?.factorToBaseUnit);
  return factor > 0 ? factor : toNumber(row.indicator?.unit?.factorToBaseUnit) || 1;
}

/**
 * Agrupa registros de producción con conversión a unidad base.
 * `total` mezcla categorías; `byIndicator` permite consultas homogéneas.
 */
export function aggregateProduction(
  rows: ProductionRow[],
  keyFn: (row: ProductionRow) => string,
  labelFn: (row: ProductionRow) => string,
): AggregatedProduction[] {
  const groups = new Map<string, AggregatedProduction>();
  for (const row of rows) {
    const key = keyFn(row) || 'sin-dato';
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: labelFn(row) || 'Sin dato',
        records: 0,
        rawValue: 0,
        baseValue: 0,
        byIndicator: {},
      };
      groups.set(key, group);
    }
    const value = toNumber(row.value);
    group.records += 1;
    group.rawValue += value;
    group.baseValue += value * rowFactor(row);
    group.byIndicator[row.indicatorId] =
      (group.byIndicator[row.indicatorId] || 0) + value * rowFactor(row);
  }
  return Array.from(groups.values()).map((group) => ({
    ...group,
    rawValue: round(group.rawValue),
    baseValue: round(group.baseValue),
    byIndicator: Object.fromEntries(
      Object.entries(group.byIndicator).map(([key, value]) => [key, round(value)]),
    ),
  }));
}

export function aggregateByIndicator(rows: ProductionRow[]): AggregatedProduction[] {
  return aggregateProduction(
    rows,
    (row) => row.indicatorId,
    (row) => `${row.indicator.name} (${row.indicator.unit.symbol})`,
  );
}

/** Objetivos vigentes para el rango solicitado, ya limitados al tenant. */
export async function fetchTargets(
  prisma: PrismaService,
  tenantId: string,
  filters: ProductionFilters = {},
) {
  const where: Record<string, any> = tenantWhere(tenantId);
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.mineId) where.mineId = filters.mineId;
  if (filters.areaId) where.areaId = filters.areaId;
  if (filters.indicatorId) where.indicatorId = filters.indicatorId;

  return prisma.productionTarget.findMany({
    where,
    select: {
      id: true,
      indicatorId: true,
      period: true,
      year: true,
      month: true,
      day: true,
      targetValue: true,
      indicator: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: { select: { id: true, code: true, symbol: true, factorToBaseUnit: true } },
        },
      },
    },
  });
}

/** Un objetivo aplica si su periodo cae dentro del rango consultado. */
export function targetInRange(
  target: { period: string; year: number; month: number | null; day: number | null },
  from?: string | Date,
  to?: string | Date,
): boolean {
  const start = normalizeDate(from);
  const end = normalizeDate(to);
  if (!start && !end) return true;

  const years: number[] = [];
  if (start && end) {
    for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
      years.push(year);
    }
  } else {
    years.push((start || end)!.getUTCFullYear());
  }
  if (!years.includes(target.year)) return false;

  if (target.period === 'DAILY') {
    if (!target.month || !target.day) return false;
    const targetDate = new Date(Date.UTC(target.year, target.month - 1, target.day));
    if (start && targetDate < new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))) return false;
    if (end && targetDate > new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))) return false;
    return true;
  }
  if (target.period === 'MONTHLY' && target.month) {
    if (!start || !end) return true;
    const startMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
    const endMonth = end.getUTCFullYear() * 12 + end.getUTCMonth();
    const targetMonth = target.year * 12 + (target.month - 1);
    return targetMonth >= startMonth && targetMonth <= endMonth;
  }
  // WEEKLY (y objetivos anuales sin mes): se comparan por año/mes del rango.
  if (target.month && start && end) {
    const startMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
    const endMonth = end.getUTCFullYear() * 12 + end.getUTCMonth();
    const targetMonth = target.year * 12 + (target.month - 1);
    return targetMonth >= startMonth && targetMonth <= endMonth;
  }
  return true;
}

export interface TargetComparison {
  indicatorId: string;
  indicatorName: string;
  code: string;
  unit: { id: string; code: string; symbol: string };
  actual: number;
  target: number;
  difference: number;
  compliancePct: number | null;
  targets: Array<{
    id: string;
    period: string;
    year: number;
    month: number | null;
    day: number | null;
    value: number;
  }>;
}

/** Compara la producción agregada (unidad base) contra los objetivos del periodo. */
export function compareWithTargets(
  actual: AggregatedProduction[],
  targets: any[],
  from?: string | Date,
  to?: string | Date,
): TargetComparison[] {
  const relevant = targets.filter((target) => targetInRange(target, from, to));
  return actual.map((entry) => {
    const matching = relevant.filter((target) => target.indicatorId === entry.key);
    const targetValue = round(
      matching.reduce(
        (sum, target) =>
          sum + toNumber(target.targetValue) * toNumber(target.indicator?.unit?.factorToBaseUnit || 1),
        0,
      ),
    );
    const unit = matching[0]?.indicator?.unit;
    return {
      indicatorId: entry.key,
      indicatorName: entry.label,
      code: matching[0]?.indicator?.code || entry.key,
      unit: unit
        ? { id: unit.id, code: unit.code, symbol: unit.symbol }
        : { id: '', code: '', symbol: '' },
      actual: entry.baseValue,
      target: targetValue,
      difference: round(entry.baseValue - targetValue),
      compliancePct: targetValue > 0 ? round((entry.baseValue / targetValue) * 100, 2) : null,
      targets: matching.map((target) => ({
        id: target.id,
        period: target.period,
        year: target.year,
        month: target.month,
        day: target.day,
        value: round(
          toNumber(target.targetValue) * toNumber(target.indicator?.unit?.factorToBaseUnit || 1),
        ),
      })),
    };
  });
}
