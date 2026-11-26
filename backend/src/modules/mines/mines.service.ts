import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AreaType, AuditAction, MineMode, MineStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import { CreateMineDto, UpdateMineDto } from './dto/mines.dto';

@Injectable()
export class MinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.mode) where.mode = query.mode;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { code: { contains: String(query.search), mode: 'insensitive' } },
        { name: { contains: String(query.search), mode: 'insensitive' } },
        { description: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.mine.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, code: true, name: true } },
          _count: { select: { areas: true, reports: true } },
        },
      }),
      this.prisma.mine.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const mine = await this.prisma.mine.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        project: { select: { id: true, code: true, name: true, status: true } },
        _count: { select: { areas: true, targets: true, reports: true } },
      },
    });
    if (!mine) throw new NotFoundException('Mina no encontrada');
    return mine;
  }

  modes() {
    return Object.values(MineMode);
  }

  async create(tenantId: string, dto: CreateMineDto, actorId: string) {
    await this.assertProject(tenantId, dto.projectId);
    const mine = await this.prisma.mine.create({
      data: tenantData(tenantId, {
        projectId: dto.projectId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        mode: dto.mode,
        status: dto.status || MineStatus.PLANNED,
        description: dto.description,
        latitude: this.decimal(dto.latitude, 'latitude'),
        longitude: this.decimal(dto.longitude, 'longitude'),
      }) as Prisma.MineUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Mine',
      entityId: mine.id,
      after: dto,
    });
    return this.findOne(tenantId, mine.id);
  }

  async update(tenantId: string, id: string, dto: UpdateMineDto, actorId: string) {
    const existing = await this.findOne(tenantId, id);
    await this.assertProject(tenantId, dto.projectId);

    const data: Record<string, any> = {};
    if (dto.projectId !== undefined) data.projectId = dto.projectId;
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.mode !== undefined) data.mode = dto.mode;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.latitude !== undefined) data.latitude = this.decimal(dto.latitude, 'latitude');
    if (dto.longitude !== undefined) data.longitude = this.decimal(dto.longitude, 'longitude');

    if (dto.mode && dto.mode !== existing.mode) {
      const incompatible = await this.prisma.mineArea.findFirst({
        where: tenantWhere(tenantId, { mineId: id, type: { notIn: this.areaTypesForMode(dto.mode) } }),
        select: { id: true },
      });
      if (incompatible) {
        throw new BadRequestException(
          'La mina tiene áreas no compatibles con el nuevo modo; actualícelas primero',
        );
      }
    }

    await this.prisma.mine.updateMany({ where: tenantWhere(tenantId, { id }), data });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Mine',
      entityId: id,
      after: dto,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    await this.findOne(tenantId, id);
    await this.prisma.mine.deleteMany({ where: tenantWhere(tenantId, { id }) });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Mine',
      entityId: id,
    });
    return { success: true };
  }

  private areaTypesForMode(mode: MineMode): AreaType[] {
    const openPit = [
      AreaType.BENCH,
      AreaType.PHASE,
      AreaType.EXTRACTION_FRONT,
      AreaType.HAUL_ROAD,
    ];
    const underground = [
      AreaType.LEVEL,
      AreaType.DRIFT,
      AreaType.RAMP,
      AreaType.ADVANCE_FRONT,
    ];
    return [...(mode === MineMode.OPEN_PIT ? openPit : underground), AreaType.OTHER];
  }

  private decimal(value: number | null | undefined, field: string): number | null {
    if (value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new BadRequestException(`${field} no es válido`);
    return number;
  }

  private async assertProject(tenantId: string, id?: string) {
    if (!id) return;
    const project = await this.prisma.project.findFirst({
      where: tenantWhere(tenantId, { id }),
      select: { id: true },
    });
    if (!project) throw new BadRequestException('El proyecto no pertenece a la empresa');
  }
}
