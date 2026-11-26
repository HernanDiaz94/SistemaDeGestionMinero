import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWhere } from '../../common/tenant/tenant-scope';
import {
  aggregateByIndicator,
  buildReportWhere,
  compareWithTargets,
  fetchApprovedProduction,
  fetchTargets,
  normalizeDate,
  ProductionRow,
  round,
  toNumber,
} from '../analytics/analytics-aggregation.helper';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string, query: Record<string, any>) {
    const filters = {
      projectId: query.projectId as string | undefined,
      mineId: query.mineId as string | undefined,
      areaId: query.areaId as string | undefined,
      from: query.from as string | Date | undefined,
      to: query.to as string | Date | undefined,
    };

    const now = new Date();
    const todayStart = this.utcDay(now);
    // Los límites se envían un milisegundo antes de la medianoche siguiente
    // porque buildReportWhere usa `lte` para el filtro `to`.
    const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1);

    const approvedScope = buildReportWhere(tenantId, filters, 'APPROVED');

    const [projectCount, mineCount, employeeCount] = await Promise.all([
      this.prisma.project.count({
        where: tenantWhere(tenantId, {
          status: 'ACTIVE',
          ...(filters.projectId ? { id: filters.projectId } : {}),
        }),
      }),
      this.prisma.mine.count({
        where: tenantWhere(tenantId, {
          status: 'ACTIVE',
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
          ...(filters.mineId ? { id: filters.mineId } : {}),
        }),
      }),
      this.prisma.employee.count({
        where: tenantWhere(tenantId, {
          status: 'ACTIVE',
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
        }),
      }),
    ]);

    const [dayRows, monthRows, rangeRows, targets] = await Promise.all([
      fetchApprovedProduction(this.prisma, tenantId, {
        ...filters,
        from: todayStart,
        to: todayEnd,
      }),
      fetchApprovedProduction(this.prisma, tenantId, {
        ...filters,
        from: monthStart,
        to: monthEnd,
      }),
      fetchApprovedProduction(this.prisma, tenantId, filters),
      fetchTargets(this.prisma, tenantId, filters),
    ]);

    const dayProduction = aggregateByIndicator(dayRows);
    const monthProduction = aggregateByIndicator(monthRows);
    const targetCompliance = compareWithTargets(
      monthProduction,
      targets,
      monthStart,
      monthEnd,
    );

    const equipmentScope = tenantWhere(tenantId, {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
    });
    const [equipmentGroups, equipmentTotal] = await Promise.all([
      this.prisma.equipment.groupBy({
        by: ['status'],
        where: equipmentScope,
        _count: { _all: true },
      }),
      this.prisma.equipment.count({ where: equipmentScope }),
    ]);
    const equipmentByStatus = Object.fromEntries(
      equipmentGroups.map((group) => [group.status, group._count._all]),
    );

    const hoursFromIndicators = round(
      rangeRows
        .filter((row) => row.indicator.category === 'TIME')
        .reduce((sum, row) => sum + toNumber(row.value) * this.rowFactor(row), 0),
    );
    const employeeHours = await this.prisma.reportEmployee.aggregate({
      where: tenantWhere(tenantId, { report: approvedScope }),
      _sum: { hours: true },
    });

    const pendingWhere = tenantWhere(tenantId, {
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.mineId ? { mineId: filters.mineId } : {}),
      ...(filters.areaId ? { areaId: filters.areaId } : {}),
    });
    const [pendingCount, pendingReports] = await Promise.all([
      this.prisma.operationReport.count({ where: pendingWhere }),
      this.prisma.operationReport.findMany({
        where: pendingWhere,
        orderBy: { date: 'desc' },
        take: 5,
        select: {
          id: true,
          code: true,
          date: true,
          status: true,
          project: { select: { id: true, name: true } },
          mine: { select: { id: true, name: true } },
        },
      }),
    ]);

    const scopeWhere = tenantWhere(tenantId, {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.mineId ? { mineId: filters.mineId } : {}),
      ...(filters.areaId ? { areaId: filters.areaId } : {}),
    });
    const latestReports = await this.prisma.operationReport.findMany({
      where: scopeWhere,
      orderBy: { date: 'desc' },
      take: 6,
      select: {
        id: true,
        code: true,
        date: true,
        status: true,
        project: { select: { id: true, name: true } },
        mine: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true } },
        _count: { select: { activities: true, production: true } },
      },
    });

    const seriesRows = await fetchApprovedProduction(this.prisma, tenantId, {
      projectId: filters.projectId,
      mineId: filters.mineId,
      areaId: filters.areaId,
      from: new Date(todayStart.getTime() - 29 * DAY_MS),
      to: todayEnd,
    });

    const last30 = this.buildSeries(seriesRows, 30, todayStart);

    return {
      // Alias planos para consumidores que esperan KPI directos.
      activeProjects: projectCount,
      activeMines: mineCount,
      pendingReports: pendingCount,
      totalProduction: round(monthProduction.reduce((sum, item) => sum + item.baseValue, 0)),
      productionByIndicator: monthProduction,
      productionByDay: last30,
      projects: { active: projectCount },
      mines: { active: mineCount },
      production: {
        today: dayProduction,
        month: monthProduction,
      },
      targets: targetCompliance,
      equipment: {
        total: equipmentTotal,
        operational: equipmentByStatus.OPERATIONAL || 0,
        maintenance: equipmentByStatus.MAINTENANCE || 0,
        outOfService: equipmentByStatus.OUT_OF_SERVICE || 0,
        inactive: equipmentByStatus.INACTIVE || 0,
      },
      hours: {
        fromTimeIndicators: hoursFromIndicators,
        fromEmployees: round(toNumber(employeeHours._sum.hours)),
        total: round(hoursFromIndicators + toNumber(employeeHours._sum.hours)),
      },
      personnel: { active: employeeCount },
      pendingReportDetails: pendingReports,
      productionSeries: {
        last7: this.buildSeries(seriesRows, 7, todayStart),
        last30,
      },
      latestActivities: latestReports,
      generatedAt: new Date().toISOString(),
    };
  }

  private utcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private rowFactor(row: ProductionRow): number {
    const factor = toNumber(row.unit?.factorToBaseUnit);
    return factor > 0 ? factor : toNumber(row.indicator?.unit?.factorToBaseUnit) || 1;
  }

  private buildSeries(rows: ProductionRow[], days: number, today: Date) {
    const series = new Map<string, { date: string; total: number; byIndicator: Record<string, number> }>();
    for (let offset = days - 1; offset >= 0; offset--) {
      const date = new Date(today.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
      series.set(date, { date, total: 0, byIndicator: {} });
    }
    for (const row of rows) {
      const date = normalizeDate(row.report.date)?.toISOString().slice(0, 10);
      if (!date) continue;
      const entry = series.get(date);
      if (!entry) continue;
      const value = toNumber(row.value) * this.rowFactor(row);
      entry.total = round(entry.total + value);
      entry.byIndicator[row.indicatorId] = round(
        (entry.byIndicator[row.indicatorId] || 0) + value,
      );
    }
    return Array.from(series.values());
  }
}
