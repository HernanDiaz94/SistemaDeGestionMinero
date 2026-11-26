import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AreaType, AuditAction, EmployeeStatus, MineMode, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantData,
  tenantWhere,
} from '../../common/tenant/tenant-scope';
import { CreateAreaDto, UpdateAreaDto } from './dto/areas.dto';

const OPEN_PIT_TYPES: AreaType[] = [
  AreaType.BENCH,
  AreaType.PHASE,
  AreaType.EXTRACTION_FRONT,
  AreaType.HAUL_ROAD,
];

const UNDERGROUND_TYPES: AreaType[] = [
  AreaType.LEVEL,
  AreaType.DRIFT,
  AreaType.RAMP,
  AreaType.ADVANCE_FRONT,
];

@Injectable()
export class AreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.mineId) where.mineId = query.mineId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.parentId) where.parentId = query.parentId;
    if (query.projectId) where.mine = { projectId: query.projectId };
    if (query.search) {
      where.OR = [
        { code: { contains: String(query.search), mode: 'insensitive' } },
        { name: { contains: String(query.search), mode: 'insensitive' } },
        { description: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.mineArea.findMany({
        where: tenantWhere(tenantId, where),
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          mine: { select: { id: true, code: true, name: true, mode: true } },
          parent: { select: { id: true, code: true, name: true } },
          _count: { select: { children: true, activities: true } },
        },
      }),
      this.prisma.mineArea.count({ where: tenantWhere(tenantId, where) }),
    ]);
    return paginated(items, total, page, limit);
  }

  async tree(tenantId: string, query: Record<string, any>) {
    if (!query.mineId) throw new BadRequestException('mineId es obligatorio');
    await this.assertMine(tenantId, query.mineId);

    const areas = await this.prisma.mineArea.findMany({
      where: tenantWhere(tenantId, { mineId: String(query.mineId) }),
      orderBy: [{ code: 'asc' }],
    });
    const nodes = new Map<string, any>();
    for (const area of areas) nodes.set(area.id, { ...area, children: [] as any[] });

    const roots: any[] = [];
    for (const area of areas) {
      const node = nodes.get(area.id)!;
      const parent = area.parentId ? nodes.get(area.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async findOne(tenantId: string, id: string) {
    const area = await this.prisma.mineArea.findFirst({
      where: tenantWhere(tenantId, { id }),
      include: {
        mine: { select: { id: true, code: true, name: true, mode: true } },
        parent: { select: { id: true, code: true, name: true, type: true } },
        children: {
          select: { id: true, code: true, name: true, type: true, status: true },
          orderBy: { code: 'asc' },
        },
        _count: { select: { activities: true, targets: true, reports: true } },
      },
    });
    if (!area) throw new NotFoundException('Área no encontrada');
    return area;
  }

  async create(tenantId: string, dto: CreateAreaDto, actorId: string) {
    const mine = await this.assertMine(tenantId, dto.mineId);
    this.assertTypeForMode(mine.mode, dto.type);
    await this.assertParent(tenantId, dto.parentId, dto.mineId);

    const area = await this.prisma.mineArea.create({
      data: tenantData(tenantId, {
        mineId: dto.mineId,
        parentId: dto.parentId || null,
        code: dto.code.trim(),
        name: dto.name.trim(),
        type: dto.type,
        description: dto.description,
        status: dto.status || EmployeeStatus.ACTIVE,
      }) as Prisma.MineAreaUncheckedCreateInput,
    });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'MineArea',
      entityId: area.id,
      after: dto,
    });
    return this.findOne(tenantId, area.id);
  }

  async update(tenantId: string, id: string, dto: UpdateAreaDto, actorId: string) {
    const existing = await this.findOne(tenantId, id);
    const mineId = dto.mineId ?? existing.mineId;
    const type = dto.type ?? existing.type;
    const parentId = dto.parentId !== undefined ? dto.parentId : existing.parentId;

    const mine = await this.assertMine(tenantId, mineId);
    this.assertTypeForMode(mine.mode, type);
    await this.assertParent(tenantId, parentId, mineId, id);

    const data: Record<string, any> = {};
    if (dto.mineId !== undefined) data.mineId = dto.mineId;
    if (dto.parentId !== undefined) data.parentId = dto.parentId;
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;

    await this.prisma.mineArea.updateMany({ where: tenantWhere(tenantId, { id }), data });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'MineArea',
      entityId: id,
      after: dto,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    await this.findOne(tenantId, id);
    const children = await this.prisma.mineArea.count({
      where: tenantWhere(tenantId, { parentId: id }),
    });
    if (children > 0) throw new BadRequestException('El área tiene subáreas asociadas');
    await this.prisma.mineArea.deleteMany({ where: tenantWhere(tenantId, { id }) });
    await this.audit.log({
      tenantId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'MineArea',
      entityId: id,
    });
    return { success: true };
  }

  private assertTypeForMode(mode: MineMode, type: AreaType) {
    const allowed = mode === MineMode.OPEN_PIT ? OPEN_PIT_TYPES : UNDERGROUND_TYPES;
    if (type === AreaType.OTHER || allowed.includes(type)) return;
    throw new BadRequestException(
      `El tipo ${type} no es compatible con una mina de modo ${mode}`,
    );
  }

  private async assertMine(tenantId: string, id?: string | null) {
    if (!id) throw new BadRequestException('mineId es obligatorio');
    const mine = await this.prisma.mine.findFirst({
      where: tenantWhere(tenantId, { id }),
      select: { id: true, mode: true },
    });
    if (!mine) throw new NotFoundException('Mina no encontrada');
    return mine;
  }

  private async assertParent(
    tenantId: string,
    parentId: string | null | undefined,
    mineId: string,
    currentId?: string,
  ) {
    if (!parentId) return;
    if (parentId === currentId) throw new BadRequestException('El área no puede ser su propio padre');
    const parent = await this.prisma.mineArea.findFirst({
      where: tenantWhere(tenantId, { id: parentId }),
      select: { id: true, mineId: true },
    });
    if (!parent) throw new NotFoundException('Área padre no encontrada');
    if (parent.mineId !== mineId) {
      throw new BadRequestException('El área padre debe pertenecer a la misma mina');
    }
  }
}
