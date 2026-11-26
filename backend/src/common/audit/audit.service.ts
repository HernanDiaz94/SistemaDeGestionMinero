import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId?: string;
    actorId?: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    before?: any;
    after?: any;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId ?? null,
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        before: params.before ?? undefined,
        after: params.after ?? undefined,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  async findAll(tenantId: string, filters: Record<string, any> = {}) {
    const where: Record<string, any> = tenantId ? { tenantId } : {};
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(filters.limit) || 100, 500),
      include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }
}
