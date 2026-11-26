import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GlobalRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../common/audit/audit.service';
import { AuthUser } from '../../common/auth/interfaces';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get accessSecret() {
    return this.config.get<string>('JWT_ACCESS_SECRET') || 'dev-access-secret-change-me';
  }

  private get refreshSecret() {
    return this.config.get<string>('JWT_REFRESH_SECRET') || 'dev-refresh-secret-change-me';
  }

  private async loadMemberships(userId: string) {
    return this.prisma.tenantUser.findMany({
      where: { userId, status: UserStatus.ACTIVE },
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true, timezone: true } },
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
  }

  /** Catálogo completo de empresas para el superadministrador. */
  private tenantCatalog() {
    return this.prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, status: true, timezone: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Membresía virtual para que el superadministrador pueda operar dentro de una empresa. */
  private syntheticMembership(
    tenant: { id: string; name: string; slug: string; status: any; timezone: string },
    userId: string,
  ): Awaited<ReturnType<AuthService['loadMemberships']>>[number] {
    return {
      id: undefined,
      tenantId: tenant.id,
      userId,
      status: UserStatus.ACTIVE,
      tenant,
      roles: [],
    } as unknown as Awaited<ReturnType<AuthService['loadMemberships']>>[number];
  }

  private buildPayload(
    user: { id: string; email: string; globalRole: GlobalRole },
    membership: Awaited<ReturnType<AuthService['loadMemberships']>>[number] | undefined,
  ): AuthUser {
    const permissions = new Set<string>();
    if (membership) {
      for (const userRole of membership.roles) {
        for (const rp of userRole.role.permissions) permissions.add(rp.permission.key);
      }
    }
    return {
      userId: user.id,
      email: user.email,
      globalRole: user.globalRole,
      tenantId: membership?.tenantId,
      tenantUserId: membership?.id,
      permissions: Array.from(permissions),
    };
  }

  private async issueTokens(payload: AuthUser) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') || '15m') as any,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: payload.userId, tenantId: payload.tenantId, type: 'refresh' },
      {
        secret: this.refreshSecret,
        expiresIn: (this.config.get<string>('JWT_REFRESH_TTL') || '7d') as any,
      },
    );
    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string } = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const memberships = await this.loadMemberships(user.id);
    let membership: Awaited<ReturnType<AuthService['loadMemberships']>>[number] | undefined =
      memberships[0];
    if (dto.tenantSlug) {
      membership = memberships.find((m) => m.tenant.slug === dto.tenantSlug);
      if (!membership && user.globalRole !== GlobalRole.SUPERADMIN) {
        throw new UnauthorizedException('No tienes acceso a esa empresa');
      }
    }
    if (!membership && user.globalRole !== GlobalRole.SUPERADMIN) {
      throw new UnauthorizedException('El usuario no tiene empresas asignadas');
    }

    // El superadministrador puede trabajar dentro de una empresa sin membresía.
    if (!membership && dto.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
      if (!tenant) throw new BadRequestException('Empresa no encontrada');
      membership = this.syntheticMembership(tenant, user.id);
    }

    const payload = this.buildPayload(user, membership);
    const tokens = await this.issueTokens(payload);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      tenantId: payload.tenantId,
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        globalRole: user.globalRole,
        tenantId: payload.tenantId,
        tenantName: membership?.tenant.name ?? null,
        tenantSlug: membership?.tenant.slug ?? null,
        timezone: membership?.tenant.timezone ?? 'UTC',
        permissions: payload.permissions,
      },
      tenants: user.globalRole === GlobalRole.SUPERADMIN
        ? (await this.tenantCatalog()).map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            status: t.status,
          }))
        : memberships.map((m) => ({
            id: m.tenant.id,
            name: m.tenant.name,
            slug: m.tenant.slug,
            status: m.tenant.status,
          })),
    };
  }

  async refresh(dto: RefreshDto) {
    let payload: { sub: string; tenantId?: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(dto.refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Token inválido');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    const memberships = await this.loadMemberships(user.id);
    let membership = payload.tenantId
      ? memberships.find((m) => m.tenantId === payload.tenantId)
      : memberships[0];
    if (!membership && user.globalRole === GlobalRole.SUPERADMIN && payload.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: payload.tenantId } });
      if (tenant) membership = this.syntheticMembership(tenant, user.id);
    }
    if (!membership && user.globalRole !== GlobalRole.SUPERADMIN) {
      throw new UnauthorizedException('Membresía inválida');
    }
    const authPayload = this.buildPayload(user, membership);
    return this.issueTokens(authPayload);
  }

  async switchTenant(userId: string, tenantSlug: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const memberships = await this.loadMemberships(userId);
    let membership = memberships.find((m) => m.tenant.slug === tenantSlug);
    if (!membership && user.globalRole === GlobalRole.SUPERADMIN) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) throw new BadRequestException('Empresa no encontrada');
      membership = this.syntheticMembership(tenant, user.id);
    }
    if (!membership) {
      throw new BadRequestException('No tienes acceso a esa empresa');
    }
    const payload = this.buildPayload(user, membership);
    await this.audit.log({
      tenantId: payload.tenantId,
      actorId: userId,
      action: 'SWITCH_TENANT',
      entityType: 'Tenant',
      entityId: membership?.tenantId,
    });
    return { ...(await this.issueTokens(payload)), user: payload };
  }

  async me(userId: string, tenantId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        globalRole: true,
        status: true,
        lastLoginAt: true,
      },
    });
    const memberships = await this.loadMemberships(userId);
    let membership = tenantId ? memberships.find((m) => m.tenantId === tenantId) : memberships[0];
    const catalog = user.globalRole === GlobalRole.SUPERADMIN ? await this.tenantCatalog() : null;

    if (user.globalRole === GlobalRole.SUPERADMIN) {
      // Sin tenant activo el superadmin trabaja en el panel global.
      if (!tenantId) membership = undefined;
      else if (!membership) {
        const tenant = catalog?.find((t) => t.id === tenantId);
        if (tenant) membership = this.syntheticMembership(tenant, userId);
      }
    }

    const permissions = new Set<string>();
    if (membership) {
      for (const ur of membership.roles)
        for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
    }
    return {
      ...user,
      tenant: membership?.tenant ?? null,
      roles: membership?.roles.map((ur) => ({ key: ur.role.key, name: ur.role.name })) ?? [],
      permissions: Array.from(permissions),
      tenants: catalog
        ? catalog.map((t) => ({ id: t.id, name: t.name, slug: t.slug, status: t.status }))
        : memberships.map((m) => ({
            id: m.tenant.id,
            name: m.tenant.name,
            slug: m.tenant.slug,
          })),
      timezone: membership?.tenant.timezone ?? 'UTC',
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Contraseña actual incorrecta');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) },
    });
    return { success: true };
  }
}
