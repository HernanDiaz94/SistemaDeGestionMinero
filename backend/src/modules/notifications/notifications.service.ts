import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginated,
  parsePagination,
  tenantWhere,
} from '../../common/tenant/tenant-scope';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Solo las notificaciones del usuario autenticado dentro de su tenant. */
  async findAll(tenantId: string, userId: string, query: Record<string, any>) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: Record<string, any> = tenantWhere(tenantId, { userId });
    if (query.unread === true || query.unread === 'true' || query.unread === '1') {
      where.readAt = null;
    }
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async unreadCount(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: tenantWhere(tenantId, { userId, readAt: null }),
    });
    return { count };
  }

  async markRead(tenantId: string, userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: tenantWhere(tenantId, { id, userId }),
    });
    if (!notification) throw new NotFoundException('Notificación no encontrada');
    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      actorId: userId,
      action: AuditAction.UPDATE,
      entityType: 'Notification',
      entityId: id,
      before: { readAt: notification.readAt?.toISOString() ?? null },
      after: { readAt: updated.readAt?.toISOString() ?? null },
    });
    return updated;
  }
}
