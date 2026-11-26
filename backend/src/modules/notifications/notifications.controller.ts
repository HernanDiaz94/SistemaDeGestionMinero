import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/interfaces';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantGuard } from '../../common/auth/tenant.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.notifications.findAll(user.tenantId!, user.userId, query);
  }

  @Get('unread-count')
  @RequirePermissions('notifications.read')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.tenantId!, user.userId);
  }

  @Post(':id/read')
  @RequirePermissions('notifications.read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.tenantId!, user.userId, id);
  }
}
