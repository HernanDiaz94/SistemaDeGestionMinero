import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GlobalRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { parsePagination, paginated } from '../../common/tenant/tenant-scope';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = { tenantId };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.user = {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.tenantUser.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              globalRole: true,
              status: true,
              lastLoginAt: true,
            },
          },
          roles: { include: { role: { select: { id: true, key: true, name: true } } } },
        },
      }),
      this.prisma.tenantUser.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            globalRole: true,
            status: true,
            lastLoginAt: true,
          },
        },
        roles: { include: { role: true } },
      },
    });
    if (!tenantUser) throw new NotFoundException('Usuario no encontrado');
    return tenantUser;
  }

  async create(tenantId: string, dto: CreateUserDto, actorId: string) {
    const email = dto.email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (user) throw new BadRequestException('El correo ya está registrado');

    user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        firstName: dto.firstName,
        lastName: dto.lastName,
        globalRole: dto.globalRole || GlobalRole.USER,
      },
    });
    const tenantUser = await this.prisma.tenantUser.create({
      data: { tenantId, userId: user.id, status: UserStatus.ACTIVE },
    });
    await this.applyRoles(tenantId, tenantUser.id, dto.roleKeys || ['SUPERVISOR']);
    await this.audit.log({
      tenantId,
      actorId,
      action: 'CREATE',
      entityType: 'User',
      entityId: tenantUser.id,
      after: { email, roles: dto.roleKeys },
    });
    return this.findOne(tenantId, tenantUser.id);
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto, actorId: string) {
    const existing = await this.findOne(tenantId, id);
    const { roleKeys, password, status, ...userData } = dto;

    await this.prisma.user.update({
      where: { id: existing.userId },
      data: {
        ...userData,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    if (status) {
      await this.prisma.tenantUser.update({ where: { id }, data: { status } });
    }
    if (roleKeys) await this.applyRoles(tenantId, id, roleKeys);

    await this.audit.log({
      tenantId,
      actorId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      after: dto,
    });
    return this.findOne(tenantId, id);
  }

  async remove(tenantId: string, id: string, actorId: string) {
    await this.findOne(tenantId, id);
    await this.prisma.tenantUser.delete({ where: { id } });
    await this.audit.log({
      tenantId,
      actorId,
      action: 'DELETE',
      entityType: 'User',
      entityId: id,
    });
    return { success: true };
  }

  private async applyRoles(tenantId: string, tenantUserId: string, roleKeys: string[]) {
    await this.prisma.tenantUserRole.deleteMany({ where: { tenantUserId } });
    for (const key of roleKeys) {
      const role = await this.prisma.role.findFirst({
        where: { key, OR: [{ tenantId }, { tenantId: null }] },
      });
      if (!role) throw new BadRequestException(`Rol no encontrado: ${key}`);
      await this.prisma.tenantUserRole.create({ data: { tenantUserId, roleId: role.id } });
    }
  }
}
