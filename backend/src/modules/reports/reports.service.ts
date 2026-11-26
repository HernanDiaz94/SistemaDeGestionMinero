import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalDecision,
  AttachmentKind,
  AuditAction,
  ReportStatus,
} from '@prisma/client';
import { createReadStream, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { Response } from 'express';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import {
  ApproveReportDto,
  CreateReportDto,
  RejectReportDto,
  ReviewReportDto,
  UpdateReportDto,
} from './dto/reports.dto';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
};

/** Adaptador tipado para los inputs create de Prisma. */
const scopedData = (tenantId: string, data: Record<string, any>): any =>
  tenantData(tenantId, data);

@Injectable()
export class ReportsService {
  private readonly include = {
    project: { select: { id: true, code: true, name: true, status: true } },
    mine: { select: { id: true, code: true, name: true, mode: true, status: true } },
    area: { select: { id: true, code: true, name: true, type: true } },
    shift: {
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        startTime: true,
        endTime: true,
      },
    },
    supervisor: { select: USER_SELECT },
    supervisorEmployee: {
      select: { id: true, code: true, firstName: true, lastName: true, position: true },
    },
    responsibleUser: { select: { id: true, status: true } },
    createdBy: { select: USER_SELECT },
    updatedBy: { select: USER_SELECT },
    activities: {
      include: { area: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    },
    production: {
      include: {
        indicator: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            unitId: true,
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
      },
    },
    employees: {
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
      },
    },
    equipment: {
      include: {
        equipment: { select: { id: true, code: true, name: true, status: true } },
      },
    },
    attachments: { orderBy: { createdAt: 'desc' } },
    approvals: {
      include: { reviewer: { select: USER_SELECT } },
      orderBy: { decidedAt: 'desc' },
    },
    revisions: {
      include: { changedBy: { select: USER_SELECT } },
      orderBy: { version: 'desc' },
    },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = tenantWhere(tenantId);
    if (query.projectId) where.projectId = query.projectId;
    if (query.mineId) where.mineId = query.mineId;
    if (query.areaId) where.areaId = query.areaId;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.search) {
      const search = String(query.search);
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { observations: { contains: search, mode: 'insensitive' } },
        { project: { name: { contains: search, mode: 'insensitive' } } },
        { mine: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.operationReport.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          project: { select: { id: true, code: true, name: true } },
          mine: { select: { id: true, code: true, name: true } },
          area: { select: { id: true, code: true, name: true } },
          shift: { select: { id: true, code: true, name: true } },
          supervisor: { select: USER_SELECT },
          _count: {
            select: {
              activities: true,
              production: true,
              employees: true,
              equipment: true,
              attachments: true,
            },
          },
        },
      }),
      this.prisma.operationReport.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    return this.findEntity(tenantId, id);
  }

  async create(tenantId: string, dto: CreateReportDto, actorId: string) {
    await this.validateScope(tenantId, dto);
    await this.validateActivityAreas(tenantId, dto.mineId, dto.activities);
    const supervisorUserId = dto.supervisorUserId || actorId;
    await this.validateSupervisor(tenantId, supervisorUserId, dto.supervisorEmployeeId);
    await this.validateProduction(tenantId, dto.production);
    await this.validateEmployees(tenantId, dto.employees);
    await this.validateEquipment(tenantId, dto.equipment);

    const code = dto.code || (await this.generateCode(tenantId, dto.date));
    await this.assertCodeAvailable(tenantId, code);

    const report = await this.prisma.operationReport.create({
      data: scopedData(tenantId, {
        projectId: dto.projectId,
        mineId: dto.mineId,
        areaId: dto.areaId || null,
        shiftId: dto.shiftId,
        code,
        date: dto.date,
        status: ReportStatus.DRAFT,
        supervisorUserId,
        supervisorEmployeeId: dto.supervisorEmployeeId || null,
        observations: dto.observations,
        createdByUserId: actorId,
        updatedByUserId: actorId,
        version: 1,
        ...this.nestedCreateData(tenantId, dto),
      }),
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'OperationReport',
      entityId: report.id,
      after: this.asJson({ code, status: report.status, date: report.date }),
    });
    return this.findOne(tenantId, report.id);
  }

  async update(tenantId: string, id: string, dto: UpdateReportDto, actorId: string) {
    const current = await this.findEntity(tenantId, id);
    if (current.status === ReportStatus.APPROVED && !dto.rectificationReason) {
      throw new BadRequestException(
        'Para rectificar un parte aprobado se requiere rectificationReason',
      );
    }

    const scope = {
      projectId: dto.projectId ?? current.projectId,
      mineId: dto.mineId ?? current.mineId,
      areaId: dto.areaId !== undefined ? dto.areaId : current.areaId,
      shiftId: dto.shiftId ?? current.shiftId,
    };
    await this.validateScope(tenantId, scope);
    if (dto.activities) {
      await this.validateActivityAreas(tenantId, scope.mineId, dto.activities);
    }

    const supervisorUserId = dto.supervisorUserId ?? current.supervisorUserId;
    const supervisorEmployeeId =
      dto.supervisorEmployeeId !== undefined
        ? dto.supervisorEmployeeId
        : current.supervisorEmployeeId;
    await this.validateSupervisor(tenantId, supervisorUserId, supervisorEmployeeId);
    await this.validateProduction(tenantId, dto.production);
    await this.validateEmployees(tenantId, dto.employees);
    await this.validateEquipment(tenantId, dto.equipment);

    const code = dto.code ?? current.code;
    await this.assertCodeAvailable(tenantId, code, id);
    const snapshot = this.asJson(current);
    const version = current.version + 1;
    const reason =
      dto.rectificationReason || dto.updateReason || 'Actualización del parte diario';

    await this.prisma.$transaction(async (tx) => {
      await this.replaceNested(tenantId, id, dto, tx);
      await tx.operationReport.update({
        where: { id },
        data: scopedData(tenantId, {
          projectId: scope.projectId,
          mineId: scope.mineId,
          areaId: scope.areaId || null,
          shiftId: scope.shiftId,
          code,
          date: dto.date ?? current.date,
          supervisorUserId,
          supervisorEmployeeId: supervisorEmployeeId || null,
          observations:
            dto.observations !== undefined ? dto.observations : current.observations,
          updatedByUserId: actorId,
          version,
        }),
      });
      await this.recordRevision(tenantId, id, snapshot, version, reason, actorId, tx);
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'OperationReport',
      entityId: id,
      before: snapshot,
      after: this.asJson(dto),
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    const current = await this.findEntity(tenantId, id);
    for (const attachment of current.attachments) {
      await this.storage.remove(attachment.storageKey);
    }
    await this.prisma.operationReport.delete({ where: { id: current.id } });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'OperationReport',
      entityId: id,
      before: this.asJson(current),
    });
    return { success: true };
  }

  async submit(tenantId: string, id: string, actorId: string) {
    const current = await this.transition(
      tenantId,
      id,
      [ReportStatus.DRAFT, ReportStatus.REJECTED],
      ReportStatus.SUBMITTED,
      'Envío a revisión',
      actorId,
      { submittedAt: new Date(), rejectedAt: null },
    );
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.SUBMIT,
      entityType: 'OperationReport',
      entityId: id,
      before: this.asJson({ status: current.status }),
      after: this.asJson({ status: ReportStatus.SUBMITTED }),
    });
    return this.findOne(tenantId, id);
  }

  async review(tenantId: string, id: string, dto: ReviewReportDto, actorId: string) {
    const current = await this.transition(
      tenantId,
      id,
      [ReportStatus.SUBMITTED],
      ReportStatus.UNDER_REVIEW,
      dto.comments || 'Revisión iniciada',
      actorId,
    );
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'OperationReport',
      entityId: id,
      before: this.asJson({ status: current.status }),
      after: this.asJson({ status: ReportStatus.UNDER_REVIEW, comments: dto.comments }),
    });
    return this.findOne(tenantId, id);
  }

  async approve(tenantId: string, id: string, dto: ApproveReportDto, actorId: string) {
    const current = await this.findEntity(tenantId, id);
    if (
      current.status !== ReportStatus.SUBMITTED &&
      current.status !== ReportStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        `El parte no se puede aprobar desde el estado ${current.status}`,
      );
    }
    const snapshot = this.asJson(current);
    const version = current.version + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.reportApproval.create({
        data: scopedData(tenantId, {
          reportId: id,
          reviewerId: actorId,
          decision: ApprovalDecision.APPROVED,
          comments: dto.comments || null,
        }),
      });
      await tx.operationReport.update({
        where: { id },
        data: scopedData(tenantId, {
          status: ReportStatus.APPROVED,
          approvedAt: new Date(),
          updatedByUserId: actorId,
          version,
        }),
      });
      await this.recordRevision(
        tenantId,
        id,
        snapshot,
        version,
        dto.comments || 'Aprobación del parte',
        actorId,
        tx,
      );
      await tx.notification.create({
        data: scopedData(tenantId, {
          userId: current.createdByUserId,
          title: 'Parte aprobado',
          body: `El parte diario ${current.code} fue aprobado`,
          link: `/reports/${id}`,
        }),
      });
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.APPROVE,
      entityType: 'OperationReport',
      entityId: id,
      before: this.asJson({ status: current.status }),
      after: this.asJson({ status: ReportStatus.APPROVED, comments: dto.comments }),
    });
    return this.findOne(tenantId, id);
  }

  async reject(tenantId: string, id: string, dto: RejectReportDto, actorId: string) {
    const current = await this.findEntity(tenantId, id);
    if (
      current.status !== ReportStatus.SUBMITTED &&
      current.status !== ReportStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        `El parte no se puede rechazar desde el estado ${current.status}`,
      );
    }
    const snapshot = this.asJson(current);
    const version = current.version + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.reportApproval.create({
        data: scopedData(tenantId, {
          reportId: id,
          reviewerId: actorId,
          decision: ApprovalDecision.REJECTED,
          comments: dto.comments,
        }),
      });
      await tx.operationReport.update({
        where: { id },
        data: scopedData(tenantId, {
          status: ReportStatus.REJECTED,
          rejectedAt: new Date(),
          updatedByUserId: actorId,
          version,
        }),
      });
      await this.recordRevision(
        tenantId,
        id,
        snapshot,
        version,
        dto.comments,
        actorId,
        tx,
      );
    });

    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.REJECT,
      entityType: 'OperationReport',
      entityId: id,
      before: this.asJson({ status: current.status }),
      after: this.asJson({ status: ReportStatus.REJECTED, comments: dto.comments }),
    });
    return this.findOne(tenantId, id);
  }

  async findRevisions(tenantId: string, id: string) {
    await this.ensureReport(tenantId, id);
    return this.prisma.reportRevision.findMany({
      where: tenantWhere(tenantId, { reportId: id }),
      orderBy: { version: 'desc' },
      include: {
        changedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async addAttachment(
    tenantId: string,
    id: string,
    file: Express.Multer.File | undefined,
    actorId: string,
  ) {
    if (!file) throw new BadRequestException('El archivo es obligatorio (campo `file`)');
    await this.ensureReport(tenantId, id);
    const stored = await this.storage.upload(file, tenantId, 'reports');
    const kind = file.mimetype.startsWith('image/')
      ? AttachmentKind.PHOTO
      : AttachmentKind.DOCUMENT;
    const attachment = await this.prisma.reportAttachment.create({
      data: scopedData(tenantId, {
        reportId: id,
        kind,
        fileName: file.originalname,
        storageKey: stored.key,
        url: stored.url,
        mimeType: stored.mimeType,
        sizeBytes: stored.size,
        uploadedByUserId: actorId,
      }),
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'ReportAttachment',
      entityId: attachment.id,
      after: this.asJson({ reportId: id, storageKey: stored.key, kind }),
    });
    return attachment;
  }

  async listAttachments(tenantId: string, id: string) {
    await this.ensureReport(tenantId, id);
    return this.prisma.reportAttachment.findMany({
      where: tenantWhere(tenantId, { reportId: id }),
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeAttachment(
    tenantId: string,
    id: string,
    attachmentId: string,
    actorId: string,
  ) {
    const attachment = await this.prisma.reportAttachment.findFirst({
      where: tenantWhere(tenantId, { id: attachmentId, reportId: id }),
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');
    await this.storage.remove(attachment.storageKey);
    await this.prisma.reportAttachment.delete({ where: { id: attachment.id } });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'ReportAttachment',
      entityId: attachment.id,
      before: this.asJson(attachment),
    });
    return { success: true };
  }

  /** Descarga segura: la clave siempre debe pertenecer al tenant del token. */
  async serveFile(tenantId: string, rawKey: string, res: Response): Promise<StreamableFile | void> {
    const key = this.normalizeKey(rawKey);
    if (!key || !key.startsWith(`${tenantId}/`) || key.includes('..') || key.includes('\\')) {
      throw new ForbiddenException('Acceso denegado al archivo solicitado');
    }

    if (this.config.get<string>('S3_ENDPOINT')) {
      const publicUrl = this.config.get<string>('S3_PUBLIC_URL');
      if (publicUrl) {
        res.redirect(`${publicUrl.replace(/\/$/, '')}/${key}`);
        return;
      }
    }

    const localPath = this.storage.getLocalPath(key);
    if (!existsSync(localPath)) throw new NotFoundException('Archivo no encontrado');
    const attachment = await this.prisma.reportAttachment.findFirst({
      where: tenantWhere(tenantId, { storageKey: key }),
      select: { mimeType: true },
    });
    res.setHeader('Content-Type', attachment?.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${basename(localPath).replace(/"/g, '')}"`,
    );
    return new StreamableFile(createReadStream(localPath));
  }

  async exportCsv(tenantId: string, id: string): Promise<string> {
    const report = await this.findEntity(tenantId, id);
    const rows: string[][] = [
      ['Campo', 'Valor'],
      ['Código', report.code],
      ['Fecha', new Date(report.date).toISOString().slice(0, 10)],
      ['Proyecto', report.project.name],
      ['Yacimiento', report.mine.name],
      ['Sector', report.area?.name || ''],
      ['Turno', report.shift.name],
      ['Supervisor', `${report.supervisor.firstName} ${report.supervisor.lastName}`],
      ['Estado', report.status],
      ['Observaciones', report.observations || ''],
      [],
      ['Actividades'],
      ['Descripción', 'Inicio', 'Fin', 'Horas', 'Notas'],
      ...report.activities.map((activity) => [
        activity.description,
        activity.startAt?.toISOString() || '',
        activity.endAt?.toISOString() || '',
        activity.hours === null ? '' : String(activity.hours),
        activity.notes || '',
      ]),
      [],
      ['Producción'],
      ['Indicador', 'Unidad', 'Valor', 'Notas'],
      ...report.production.map((record) => [
        record.indicator.name,
        record.unit.symbol,
        String(record.value),
        record.notes || '',
      ]),
      [],
      ['Personal'],
      ['Empleado', 'Horas', 'Rol', 'Notas'],
      ...report.employees.map((entry) => [
        `${entry.employee.firstName} ${entry.employee.lastName}`,
        entry.hours === null ? '' : String(entry.hours),
        entry.role || '',
        entry.notes || '',
      ]),
      [],
      ['Maquinaria'],
      ['Equipo', 'Horas', 'Combustible (L)', 'Notas'],
      ...report.equipment.map((entry) => [
        entry.equipment.name,
        entry.hours === null ? '' : String(entry.hours),
        entry.fuelLiters === null ? '' : String(entry.fuelLiters),
        entry.notes || '',
      ]),
    ];
    return `\uFEFF${rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')}`;
  }

  private async findEntity(tenantId: string, id: string) {
    const report = await this.prisma.operationReport.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: this.include,
    });
    if (!report) throw new NotFoundException('Parte diario no encontrado');
    return report;
  }

  private async ensureReport(tenantId: string, id: string) {
    const report = await this.prisma.operationReport.findFirst({
      where: tenantWhere(tenantId, { id }),
      select: { id: true },
    });
    if (!report) throw new NotFoundException('Parte diario no encontrado');
    return report;
  }

  private async transition(
    tenantId: string,
    id: string,
    allowed: ReportStatus[],
    next: ReportStatus,
    reason: string,
    actorId: string,
    extra: Record<string, any> = {},
  ) {
    const current = await this.findEntity(tenantId, id);
    if (!allowed.includes(current.status)) {
      throw new BadRequestException(
        `El parte no se puede cambiar a ${next} desde el estado ${current.status}`,
      );
    }
    const snapshot = this.asJson(current);
    const version = current.version + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.operationReport.update({
        where: { id },
        data: scopedData(tenantId, {
          status: next,
          ...extra,
          updatedByUserId: actorId,
          version,
        }),
      });
      await this.recordRevision(tenantId, id, snapshot, version, reason, actorId, tx);
    });
    return current;
  }

  private async recordRevision(
    tenantId: string,
    reportId: string,
    snapshot: any,
    version: number,
    reason: string | null | undefined,
    actorId: string,
    tx: any = this.prisma,
  ) {
    await tx.reportRevision.create({
      data: scopedData(tenantId, {
        reportId,
        version,
        snapshot,
        reason: reason || null,
        changedByUserId: actorId,
      }),
    });
  }

  private async validateScope(
    tenantId: string,
    scope: {
      projectId?: string;
      mineId?: string;
      areaId?: string | null;
      shiftId?: string;
    },
  ) {
    if (scope.projectId) {
      const project = await this.prisma.project.findFirst({
        where: tenantWhere(tenantId, { id: scope.projectId }),
        select: { id: true },
      });
      if (!project) throw new BadRequestException('Proyecto no encontrado para la empresa');
    }
    if (scope.mineId) {
      const mine = await this.prisma.mine.findFirst({
        where: tenantWhere(tenantId, {
          id: scope.mineId,
          ...(scope.projectId ? { projectId: scope.projectId } : {}),
        }),
        select: { id: true },
      });
      if (!mine) {
        throw new BadRequestException('El yacimiento no existe o no pertenece al proyecto');
      }
    }
    if (scope.areaId) {
      const area = await this.prisma.mineArea.findFirst({
        where: tenantWhere(tenantId, {
          id: scope.areaId,
          ...(scope.mineId ? { mineId: scope.mineId } : {}),
        }),
        select: { id: true },
      });
      if (!area) {
        throw new BadRequestException('El sector no existe o no pertenece al yacimiento');
      }
    }
    if (scope.shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: tenantWhere(tenantId, { id: scope.shiftId }),
        select: { id: true, projectId: true },
      });
      if (!shift) throw new BadRequestException('Turno no encontrado para la empresa');
      if (shift.projectId && scope.projectId && shift.projectId !== scope.projectId) {
        throw new BadRequestException('El turno no pertenece al proyecto seleccionado');
      }
    }
  }

  private async validateActivityAreas(
    tenantId: string,
    mineId: string,
    activities?: Array<{ areaId?: string }>,
  ) {
    for (const activity of activities || []) {
      if (!activity.areaId) continue;
      const area = await this.prisma.mineArea.findFirst({
        where: tenantWhere(tenantId, { id: activity.areaId, mineId }),
        select: { id: true },
      });
      if (!area) {
        throw new BadRequestException(
          'El sector de la actividad no existe o no pertenece al yacimiento del parte',
        );
      }
    }
  }

  private async validateSupervisor(
    tenantId: string,
    userId: string,
    employeeId?: string | null,
  ) {
    const membership = await this.prisma.tenantUser.findFirst({
      where: tenantWhere(tenantId, { userId }),
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException('El supervisor no pertenece a la empresa activa');
    }
    if (employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: tenantWhere(tenantId, { id: employeeId }),
        select: { id: true },
      });
      if (!employee) throw new BadRequestException('Empleado supervisor no encontrado');
    }
  }

  private async validateProduction(
    tenantId: string,
    items?: Array<{ indicatorId: string; unitId: string }>,
  ) {
    for (const item of items || []) {
      const indicator = await this.prisma.productionIndicator.findFirst({
        where: tenantWhere(tenantId, { id: item.indicatorId }),
        include: { unit: true },
      });
      if (!indicator) {
        throw new BadRequestException(`Indicador no encontrado: ${item.indicatorId}`);
      }
      const unit = await this.prisma.productionUnit.findFirst({
        where: tenantWhere(tenantId, { id: item.unitId }),
      });
      if (!unit) throw new BadRequestException(`Unidad no encontrada: ${item.unitId}`);

      const sameIndicatorUnit =
        indicator.unitId === unit.id && indicator.unit?.tenantId === tenantId;
      const sameCategoryAndFactor =
        indicator.category === unit.category &&
        Number(indicator.unit?.factorToBaseUnit) === Number(unit.factorToBaseUnit);
      if (!sameIndicatorUnit && !sameCategoryAndFactor) {
        throw new BadRequestException(
          `La unidad ${unit.code} no es compatible con el indicador ${indicator.code}`,
        );
      }
    }
  }

  private async validateEmployees(
    tenantId: string,
    items?: Array<{ employeeId: string }>,
  ) {
    const seen = new Set<string>();
    for (const item of items || []) {
      if (seen.has(item.employeeId)) {
        throw new BadRequestException('El empleado está duplicado en el parte');
      }
      seen.add(item.employeeId);
      const employee = await this.prisma.employee.findFirst({
        where: tenantWhere(tenantId, { id: item.employeeId }),
        select: { id: true },
      });
      if (!employee) throw new BadRequestException('Empleado no encontrado en la empresa');
    }
  }

  private async validateEquipment(
    tenantId: string,
    items?: Array<{ equipmentId: string }>,
  ) {
    const seen = new Set<string>();
    for (const item of items || []) {
      if (seen.has(item.equipmentId)) {
        throw new BadRequestException('El equipo está duplicado en el parte');
      }
      seen.add(item.equipmentId);
      const equipment = await this.prisma.equipment.findFirst({
        where: tenantWhere(tenantId, { id: item.equipmentId }),
        select: { id: true },
      });
      if (!equipment) throw new BadRequestException('Equipo no encontrado en la empresa');
    }
  }

  private async assertCodeAvailable(tenantId: string, code: string, excludeId?: string) {
    const existing = await this.prisma.operationReport.findFirst({
      where: tenantWhere(tenantId, { code, ...(excludeId ? { id: { not: excludeId } } : {}) }),
      select: { id: true },
    });
    if (existing) throw new BadRequestException(`El código ${code} ya está en uso`);
  }

  private async generateCode(tenantId: string, date: Date): Promise<string> {
    const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const count = await this.prisma.operationReport.count({
      where: tenantWhere(tenantId, { date: { gte: dayStart, lt: dayEnd } }),
    });
    let sequence = count + 1;
    for (let attempt = 0; attempt < 200; attempt++) {
      const code = `OP-${stamp}-${String(sequence).padStart(4, '0')}`;
      const existing = await this.prisma.operationReport.findFirst({
        where: tenantWhere(tenantId, { code }),
        select: { id: true },
      });
      if (!existing) return code;
      sequence += 1;
    }
    throw new BadRequestException('No se pudo generar un código único para el parte');
  }

  private nestedCreateData(tenantId: string, dto: CreateReportDto) {
    return {
      ...(dto.activities?.length
        ? {
            activities: {
              create: dto.activities.map((item) =>
                scopedData(tenantId, {
                  areaId: item.areaId || null,
                  description: item.description,
                  startAt: item.startAt,
                  endAt: item.endAt,
                  hours: item.hours,
                  notes: item.notes,
                }),
              ),
            },
          }
        : {}),
      ...(dto.production?.length
        ? {
            production: {
              create: dto.production.map((item) =>
                scopedData(tenantId, {
                  indicatorId: item.indicatorId,
                  unitId: item.unitId,
                  value: item.value,
                  notes: item.notes,
                  recordedAt: new Date(),
                }),
              ),
            },
          }
        : {}),
      ...(dto.employees?.length
        ? {
            employees: {
              create: dto.employees.map((item) =>
                scopedData(tenantId, {
                  employeeId: item.employeeId,
                  hours: item.hours,
                  role: item.role,
                  notes: item.notes,
                }),
              ),
            },
          }
        : {}),
      ...(dto.equipment?.length
        ? {
            equipment: {
              create: dto.equipment.map((item) =>
                scopedData(tenantId, {
                  equipmentId: item.equipmentId,
                  hours: item.hours,
                  fuelLiters: item.fuelLiters,
                  notes: item.notes,
                }),
              ),
            },
          }
        : {}),
    };
  }

  private async replaceNested(
    tenantId: string,
    reportId: string,
    dto: UpdateReportDto,
    tx: any,
  ) {
    if (dto.activities) {
      await tx.operationActivity.deleteMany({ where: tenantWhere(tenantId, { reportId }) });
      if (dto.activities.length) {
        await tx.operationActivity.createMany({
          data: dto.activities.map((item) =>
            scopedData(tenantId, {
              reportId,
              areaId: item.areaId || null,
              description: item.description,
              startAt: item.startAt,
              endAt: item.endAt,
              hours: item.hours,
              notes: item.notes,
            }),
          ),
        });
      }
    }
    if (dto.production) {
      await tx.productionRecord.deleteMany({ where: tenantWhere(tenantId, { reportId }) });
      if (dto.production.length) {
        await tx.productionRecord.createMany({
          data: dto.production.map((item) =>
            scopedData(tenantId, {
              reportId,
              indicatorId: item.indicatorId,
              unitId: item.unitId,
              value: item.value,
              notes: item.notes,
              recordedAt: new Date(),
            }),
          ),
        });
      }
    }
    if (dto.employees) {
      await tx.reportEmployee.deleteMany({ where: tenantWhere(tenantId, { reportId }) });
      if (dto.employees.length) {
        await tx.reportEmployee.createMany({
          data: dto.employees.map((item) =>
            scopedData(tenantId, {
              reportId,
              employeeId: item.employeeId,
              hours: item.hours,
              role: item.role,
              notes: item.notes,
            }),
          ),
        });
      }
    }
    if (dto.equipment) {
      await tx.reportEquipment.deleteMany({ where: tenantWhere(tenantId, { reportId }) });
      if (dto.equipment.length) {
        await tx.reportEquipment.createMany({
          data: dto.equipment.map((item) =>
            scopedData(tenantId, {
              reportId,
              equipmentId: item.equipmentId,
              hours: item.hours,
              fuelLiters: item.fuelLiters,
              notes: item.notes,
            }),
          ),
        });
      }
    }
  }

  private normalizeKey(rawKey: string | string[]): string {
    return Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
  }

  private asJson(value: any) {
    return JSON.parse(JSON.stringify(value ?? null));
  }
}
