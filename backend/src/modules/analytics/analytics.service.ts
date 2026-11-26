import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantWhere } from '../../common/tenant/tenant-scope';
import {
  aggregateProduction,
  buildReportWhere,
  compareWithTargets,
  fetchApprovedProduction,
  fetchTargets,
  ProductionFilters,
  round,
  toNumber,
} from './analytics-aggregation.helper';

const EXPORT_TYPES = [
  'production-by-project',
  'production-by-mine',
  'production-by-shift',
  'production-by-activity',
  'equipment-performance',
  'equipment-hours',
  'crew-activity',
  'reports',
  'targets-vs-actual',
] as const;

type ExportType = (typeof EXPORT_TYPES)[number];

interface ExportTable {
  title: string;
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}

interface EquipmentEntry {
  equipmentId: string;
  hours: number;
  fuel: number;
  reports: number;
  equipment: {
    id: string;
    code: string;
    name: string;
    status: string;
    category: { name: string } | null;
  };
  dates: Map<string, number>;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async productionByProject(tenantId: string, query: Record<string, any>) {
    const rows = await fetchApprovedProduction(this.prisma, tenantId, query as ProductionFilters);
    const codes = new Map(rows.map((row) => [row.report.projectId, row.report.project.code]));
    const data = aggregateProduction(
      rows,
      (row) => row.report.projectId,
      (row) => row.report.project.name,
    ).map((entry) => ({ ...entry, code: codes.get(entry.key) || '' }));
    return { data, meta: this.meta(rows.length) };
  }

  async productionByMine(tenantId: string, query: Record<string, any>) {
    const rows = await fetchApprovedProduction(this.prisma, tenantId, query as ProductionFilters);
    const codes = new Map(rows.map((row) => [row.report.mineId, row.report.mine.code]));
    const projects = new Map(rows.map((row) => [row.report.mineId, row.report.project.name]));
    const data = aggregateProduction(
      rows,
      (row) => row.report.mineId,
      (row) => `${row.report.mine.name} (${row.report.project.name})`,
    ).map((entry) => ({
      ...entry,
      code: codes.get(entry.key) || '',
      project: projects.get(entry.key) || '',
    }));
    return { data, meta: this.meta(rows.length) };
  }

  async productionByShift(tenantId: string, query: Record<string, any>) {
    const rows = await fetchApprovedProduction(this.prisma, tenantId, query as ProductionFilters);
    const codes = new Map(rows.map((row) => [row.report.shiftId, row.report.shift.code]));
    const data = aggregateProduction(
      rows,
      (row) => row.report.shiftId,
      (row) => row.report.shift.name,
    ).map((entry) => ({ ...entry, code: codes.get(entry.key) || '' }));
    return { data, meta: this.meta(rows.length) };
  }

  /**
   * No existe FK directa entre actividad y producción: se agrupa por el frente
   * (área) del parte aprobado, evitando duplicar la producción por actividad.
   */
  async productionByActivity(tenantId: string, query: Record<string, any>) {
    const rows = await fetchApprovedProduction(this.prisma, tenantId, query as ProductionFilters);
    const activityCounts = await this.prisma.operationActivity.groupBy({
      by: ['areaId'],
      where: tenantWhere(
        tenantId,
        { report: buildReportWhere(tenantId, query as ProductionFilters, 'APPROVED') },
      ),
      _count: { _all: true },
    });
    const countsByArea = new Map(
      activityCounts.map((entry) => [entry.areaId || 'sin-dato', entry._count._all]),
    );
    const data = aggregateProduction(
      rows,
      (row) => row.report.areaId || 'sin-dato',
      (row) => row.report.area?.name || 'Sin sector',
    ).map((entry) => ({
      ...entry,
      activitiesCount: countsByArea.get(entry.key) || 0,
    }));
    return { data, meta: this.meta(rows.length) };
  }

  async equipmentPerformance(tenantId: string, query: Record<string, any>) {
    const entries = await this.fetchEquipmentEntries(tenantId, query);
    const data = Array.from(entries.values()).map((entry) => ({
      equipmentId: entry.equipmentId,
      code: entry.equipment.code,
      name: entry.equipment.name,
      status: entry.equipment.status,
      category: entry.equipment.category?.name || '',
      hours: round(entry.hours),
      fuelLiters: round(entry.fuel, 3),
      reports: entry.reports,
      daysWithRecords: entry.dates.size,
    }));
    return { data, meta: { records: data.length, onlyApproved: true } };
  }

  async equipmentHours(tenantId: string, query: Record<string, any>) {
    const entries = await this.fetchEquipmentEntries(tenantId, query);
    const data = Array.from(entries.values()).map((entry) => ({
      equipmentId: entry.equipmentId,
      code: entry.equipment.code,
      name: entry.equipment.name,
      totalHours: round(entry.hours),
      byDate: Object.fromEntries(
        Array.from(entry.dates.entries()).map(([date, hours]) => [date, round(hours)]),
      ),
    }));
    return { data, meta: { records: data.length, onlyApproved: true } };
  }

  async crewActivity(tenantId: string, query: Record<string, any>) {
    const entries = await this.prisma.reportEmployee.findMany({
      where: tenantWhere(
        tenantId,
        { report: buildReportWhere(tenantId, query as ProductionFilters, 'APPROVED') },
      ),
      select: {
        employeeId: true,
        hours: true,
        reportId: true,
        employee: {
          select: {
            crewId: true,
            crew: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    const groups = new Map<
      string,
      {
        crewId: string;
        crewName: string;
        code: string;
        employees: Set<string>;
        reports: Set<string>;
        hours: number;
      }
    >();
    for (const entry of entries) {
      const key = entry.employee.crewId || 'sin-cuadrilla';
      let group = groups.get(key);
      if (!group) {
        group = {
          crewId: entry.employee.crewId || '',
          crewName: entry.employee.crew?.name || 'Sin cuadrilla',
          code: entry.employee.crew?.code || '',
          employees: new Set(),
          reports: new Set(),
          hours: 0,
        };
        groups.set(key, group);
      }
      group.employees.add(entry.employeeId);
      group.reports.add(entry.reportId);
      group.hours += toNumber(entry.hours);
    }
    const data = Array.from(groups.values()).map((group) => ({
      crewId: group.crewId,
      crewName: group.crewName,
      code: group.code,
      employees: group.employees.size,
      reports: group.reports.size,
      hours: round(group.hours),
    }));
    return { data, meta: { records: entries.length, onlyApproved: true } };
  }

  async reports(tenantId: string, query: Record<string, any>) {
    const where = buildReportWhere(tenantId, query as ProductionFilters);
    const [total, byStatus, byDate, approvals] = await Promise.all([
      this.prisma.operationReport.count({ where }),
      this.prisma.operationReport.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.operationReport.groupBy({
        by: ['date'],
        where,
        _count: { _all: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.operationReport.findMany({
        where: tenantWhere(tenantId, {
          ...(query.projectId ? { projectId: query.projectId } : {}),
          ...(query.mineId ? { mineId: query.mineId } : {}),
          approvedAt: { not: null },
          submittedAt: { not: null },
        }),
        select: { submittedAt: true, approvedAt: true },
      }),
    ]);
    const approved = byStatus.find((entry) => entry.status === 'APPROVED')?._count._all || 0;
    const approvalHours = approvals
      .map((entry) =>
        entry.approvedAt && entry.submittedAt
          ? (entry.approvedAt.getTime() - entry.submittedAt.getTime()) / (60 * 60 * 1000)
          : 0,
      )
      .filter((value) => value >= 0);

    return {
      total,
      approved,
      approvalRatePct: total > 0 ? round((approved / total) * 100, 2) : 0,
      averageApprovalHours: approvalHours.length
        ? round(approvalHours.reduce((sum, value) => sum + value, 0) / approvalHours.length, 2)
        : 0,
      byStatus: byStatus.map((entry) => ({
        status: entry.status,
        count: entry._count._all,
      })),
      byDate: byDate.map((entry) => ({
        date: new Date(entry.date).toISOString().slice(0, 10),
        count: entry._count._all,
      })),
    };
  }

  async targetsVsActual(tenantId: string, query: Record<string, any>) {
    const rows = await fetchApprovedProduction(this.prisma, tenantId, query as ProductionFilters);
    const aggregated = aggregateProduction(
      rows,
      (row) => row.indicatorId,
      (row) => row.indicator.name,
    );
    const targets = await fetchTargets(this.prisma, tenantId, query as ProductionFilters);
    const comparison = compareWithTargets(aggregated, targets, query.from, query.to);
    const codes = new Map(rows.map((row) => [row.indicatorId, row.indicator.code]));
    return {
      data: comparison.map((entry) => ({ ...entry, code: codes.get(entry.indicatorId) || '' })),
      meta: this.meta(rows.length),
    };
  }

  /** Genera CSV real o XLSX con exceljs para el tipo de reporte solicitado. */
  async export(
    tenantId: string,
    type: string,
    format: string,
    query: Record<string, any>,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    if (!EXPORT_TYPES.includes(type as ExportType)) {
      throw new BadRequestException(
        `Tipo de exportación no válido. Use: ${EXPORT_TYPES.join(', ')}`,
      );
    }
    if (!['csv', 'xlsx'].includes(format)) {
      throw new BadRequestException('Formato no válido. Use csv o xlsx');
    }

    const table = await this.buildExportTable(tenantId, type as ExportType, query);
    if (format === 'csv') {
      const csv = `\uFEFF${table.rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\r\n')}`;
      return {
        buffer: Buffer.from(csv, 'utf8'),
        filename: `${table.filename}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(table.title.slice(0, 31));
    sheet.columns = table.headers.map((header) => ({
      header,
      key: header,
      width: Math.max(16, header.length + 3),
    }));
    sheet.getRow(1).font = { bold: true };
    for (const row of table.rows) {
      const record: Record<string, string | number | null> = {};
      table.headers.forEach((header, index) => {
        record[header] = row[index] ?? null;
      });
      sheet.addRow(record);
    }
    const content = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(content as any),
      filename: `${table.filename}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private meta(records: number) {
    return { records, onlyApproved: true };
  }

  private async fetchEquipmentEntries(
    tenantId: string,
    query: Record<string, any>,
  ): Promise<Map<string, EquipmentEntry>> {
    const entries = await this.prisma.reportEquipment.findMany({
      where: tenantWhere(
        tenantId,
        { report: buildReportWhere(tenantId, query as ProductionFilters, 'APPROVED') },
      ),
      select: {
        equipmentId: true,
        hours: true,
        fuelLiters: true,
        reportId: true,
        report: { select: { date: true } },
        equipment: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            category: { select: { name: true } },
          },
        },
      },
    });
    const groups = new Map<string, EquipmentEntry>();
    for (const entry of entries) {
      let group = groups.get(entry.equipmentId);
      if (!group) {
        group = {
          equipmentId: entry.equipmentId,
          hours: 0,
          fuel: 0,
          reports: 0,
          equipment: entry.equipment,
          dates: new Map(),
        };
        groups.set(entry.equipmentId, group);
      }
      group.hours += toNumber(entry.hours);
      group.fuel += toNumber(entry.fuelLiters);
      group.reports += 1;
      const date = new Date(entry.report.date).toISOString().slice(0, 10);
      group.dates.set(date, (group.dates.get(date) || 0) + toNumber(entry.hours));
    }
    return groups;
  }

  private async buildExportTable(
    tenantId: string,
    type: ExportType,
    query: Record<string, any>,
  ): Promise<ExportTable> {
    const base = { headers: ['Nombre', 'Código', 'Registros', 'Valor capturado', 'Valor unidad base'] };

    switch (type) {
      case 'production-by-project': {
        const result = await this.productionByProject(tenantId, query);
        return {
          title: 'Producción por proyecto',
          filename: 'produccion_por_proyecto',
          headers: base.headers,
          rows: result.data.map((entry) => [
            entry.label,
            entry.code,
            entry.records,
            entry.rawValue,
            entry.baseValue,
          ]),
        };
      }
      case 'production-by-mine': {
        const result = await this.productionByMine(tenantId, query);
        return {
          title: 'Producción por yacimiento',
          filename: 'produccion_por_yacimiento',
          headers: ['Yacimiento', 'Código', 'Proyecto', 'Registros', 'Valor capturado', 'Valor unidad base'],
          rows: result.data.map((entry) => [
            entry.label,
            entry.code,
            entry.project,
            entry.records,
            entry.rawValue,
            entry.baseValue,
          ]),
        };
      }
      case 'production-by-shift': {
        const result = await this.productionByShift(tenantId, query);
        return {
          title: 'Producción por turno',
          filename: 'produccion_por_turno',
          headers: base.headers,
          rows: result.data.map((entry) => [
            entry.label,
            entry.code,
            entry.records,
            entry.rawValue,
            entry.baseValue,
          ]),
        };
      }
      case 'production-by-activity': {
        const result = await this.productionByActivity(tenantId, query);
        return {
          title: 'Producción por actividad',
          filename: 'produccion_por_actividad',
          headers: ['Sector / actividad', 'Registros', 'Actividades', 'Valor capturado', 'Valor unidad base'],
          rows: result.data.map((entry) => [
            entry.label,
            entry.records,
            entry.activitiesCount,
            entry.rawValue,
            entry.baseValue,
          ]),
        };
      }
      case 'equipment-performance': {
        const result = await this.equipmentPerformance(tenantId, query);
        return {
          title: 'Rendimiento de maquinaria',
          filename: 'rendimiento_maquinaria',
          headers: ['Equipo', 'Código', 'Categoría', 'Estado', 'Horas', 'Combustible (L)', 'Partes', 'Días'],
          rows: result.data.map((entry) => [
            entry.name,
            entry.code,
            entry.category,
            entry.status,
            entry.hours,
            entry.fuelLiters,
            entry.reports,
            entry.daysWithRecords,
          ]),
        };
      }
      case 'equipment-hours': {
        const result = await this.equipmentHours(tenantId, query);
        return {
          title: 'Horas de maquinaria',
          filename: 'horas_maquinaria',
          headers: ['Equipo', 'Código', 'Horas totales', 'Días con registros'],
          rows: result.data.map((entry) => [
            entry.name,
            entry.code,
            entry.totalHours,
            Object.keys(entry.byDate).length,
          ]),
        };
      }
      case 'crew-activity': {
        const result = await this.crewActivity(tenantId, query);
        return {
          title: 'Actividad de cuadrillas',
          filename: 'actividad_cuadrillas',
          headers: ['Cuadrilla', 'Código', 'Personal', 'Partes', 'Horas'],
          rows: result.data.map((entry) => [
            entry.crewName,
            entry.code,
            entry.employees,
            entry.reports,
            entry.hours,
          ]),
        };
      }
      case 'reports': {
        const result = await this.reports(tenantId, query);
        return {
          title: 'Resumen de partes diarios',
          filename: 'resumen_partes',
          headers: ['Estado', 'Cantidad'],
          rows: [
            ...result.byStatus.map((entry) => [entry.status, entry.count]),
            ['TOTAL', result.total],
          ],
        };
      }
      case 'targets-vs-actual': {
        const result = await this.targetsVsActual(tenantId, query);
        return {
          title: 'Objetivos vs real',
          filename: 'objetivos_vs_real',
          headers: [
            'Indicador',
            'Código',
            'Unidad',
            'Real',
            'Objetivo',
            'Diferencia',
            'Cumplimiento (%)',
          ],
          rows: result.data.map((entry) => [
            entry.indicatorName,
            entry.code,
            entry.unit.symbol,
            entry.actual,
            entry.target,
            entry.difference,
            entry.compliancePct,
          ]),
        };
      }
    }
  }
}
