import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  GlobalRole,
  ModuleKey,
  SubscriptionStatus,
  TenantStatus,
  UserStatus,
} from '@prisma/client';
import { AuthUser } from '../../common/auth/interfaces';
import * as bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, MODULE_KEYS, ROLE_PERMISSIONS } from '../../common/auth/permissions';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parsePagination, paginated } from '../../common/tenant/tenant-scope';
import {
  CreateSubscriptionDto,
  CreateTenantDto,
  ToggleModuleDto,
  UpdateTenantDto,
} from './dto/tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { projects: true, tenantUsers: true } },
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
          modules: { where: { enabled: true }, select: { key: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  /** Un administrador de empresa solo puede operar sobre su propio tenant. */
  async findOneForUser(id: string, user: AuthUser) {
    if (user.globalRole !== GlobalRole.SUPERADMIN && user.tenantId !== id) {
      throw new ForbiddenException('No puedes acceder a información de otra empresa');
    }
    return this.findOne(id);
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        modules: true,
        subscriptions: { orderBy: { createdAt: 'desc' } },
        _count: {
          select: {
            projects: true,
            mines: true,
            tenantUsers: true,
            operationReports: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Empresa no encontrada');
    return tenant;
  }

  async create(dto: CreateTenantDto, actorId?: string) {
    const slug = (dto.slug || dto.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (await this.prisma.tenant.findUnique({ where: { slug } })) {
      throw new BadRequestException('El slug ya está en uso');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        legalName: dto.legalName,
        taxId: dto.taxId,
        timezone: dto.timezone || 'UTC',
        status: dto.status || TenantStatus.TRIAL,
        modules: {
          create: MODULE_KEYS.map((key) => ({ key: key as ModuleKey, enabled: true })),
        },
        subscriptions: {
          create: {
            plan: 'starter',
            status: SubscriptionStatus.TRIAL,
            maxUsers: 10,
          },
        },
      },
    });

    if (dto.adminEmail && dto.adminPassword) {
      const user = await this.prisma.user.upsert({
        where: { email: dto.adminEmail.toLowerCase() },
        create: {
          email: dto.adminEmail.toLowerCase(),
          passwordHash: await bcrypt.hash(dto.adminPassword, 10),
          firstName: 'Administrador',
          lastName: dto.name,
        },
        update: {},
      });
      const tenantUser = await this.prisma.tenantUser.create({
        data: { tenantId: tenant.id, userId: user.id, status: UserStatus.ACTIVE },
      });
      await this.assignSystemRoles(tenantUser.id, ['ADMIN_EMPRESARIAL']);
    }

    await this.audit.log({
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Tenant',
      entityId: tenant.id,
      after: { name: tenant.name, slug: tenant.slug },
    });
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, actorId?: string) {
    const before = await this.findOne(id);
    const tenant = await this.prisma.tenant.update({ where: { id }, data: dto });
    await this.audit.log({
      tenantId: id,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Tenant',
      entityId: id,
      before: { name: before.name, status: before.status, timezone: before.timezone },
      after: { name: tenant.name, status: tenant.status, timezone: tenant.timezone },
    });
    return tenant;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.tenant.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Tenant',
      entityId: id,
    });
    return { success: true };
  }

  private async assignSystemRoles(tenantUserId: string, keys: string[]) {
    for (const key of keys) {
      const role = await this.prisma.role.findFirst({
        where: { tenantId: null, key, isSystem: true },
      });
      if (!role) continue;
      await this.prisma.tenantUserRole.upsert({
        where: { tenantUserId_roleId: { tenantUserId, roleId: role.id } },
        create: { tenantUserId, roleId: role.id },
        update: {},
      });
    }
  }

  async toggleModule(tenantId: string, dto: ToggleModuleDto) {
    await this.findOne(tenantId);
    return this.prisma.tenantModule.upsert({
      where: { tenantId_key: { tenantId, key: dto.key } },
      create: { tenantId, key: dto.key, enabled: dto.enabled ?? true },
      update: { enabled: dto.enabled ?? true },
    });
  }

  async listModules(tenantId: string) {
    const modules = await this.prisma.tenantModule.findMany({ where: { tenantId } });
    return MODULE_KEYS.map((key) => ({
      key,
      enabled: modules.find((m) => m.key === key)?.enabled ?? true,
    }));
  }

  async createSubscription(tenantId: string, dto: CreateSubscriptionDto) {
    await this.findOne(tenantId);
    return this.prisma.subscription.create({
      data: {
        tenantId,
        plan: dto.plan,
        status: (dto.status as SubscriptionStatus) || SubscriptionStatus.ACTIVE,
        maxUsers: dto.maxUsers ?? 10,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      include: { permissions: { include: { permission: true } } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async assignRole(tenantId: string, tenantUserId: string, roleKey: string) {
    const tu = await this.prisma.tenantUser.findFirst({ where: { id: tenantUserId, tenantId } });
    if (!tu) throw new NotFoundException('Usuario de la empresa no encontrado');
    const role = await this.prisma.role.findFirst({
      where: { key: roleKey, OR: [{ tenantId }, { tenantId: null }] },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    await this.prisma.tenantUserRole.upsert({
      where: { tenantUserId_roleId: { tenantUserId, roleId: role.id } },
      create: { tenantUserId, roleId: role.id },
      update: {},
    });
    return { success: true };
  }

  async seedPermissions() {
    for (const key of ALL_PERMISSIONS) {
      const [module, ...rest] = key.split('.');
      await this.prisma.permission.upsert({
        where: { key },
        create: { key, module: module.toLowerCase(), action: rest.join('.'), description: key },
        update: {},
      });
    }
  }

  async seedRoles() {
    await this.seedPermissions();
    for (const [key, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      let role = await this.prisma.role.findFirst({ where: { tenantId: null, key } });
      if (!role) {
        role = await this.prisma.role.create({
          data: {
            tenantId: null,
            key,
            name: key.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
            isSystem: true,
            description: `Rol del sistema ${key}`,
          },
        });
      }
      for (const permissionKey of permissions) {
        const permission = await this.prisma.permission.findUnique({ where: { key: permissionKey } });
        if (!permission) continue;
        await this.prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          create: { roleId: role.id, permissionId: permission.id },
          update: {},
        });
      }
    }
  }
}
