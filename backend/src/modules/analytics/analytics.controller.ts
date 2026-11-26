import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/interfaces';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantGuard } from '../../common/auth/tenant.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('production-by-project')
  @RequirePermissions('analytics.read')
  productionByProject(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.productionByProject(user.tenantId!, query);
  }

  @Get('production-by-mine')
  @RequirePermissions('analytics.read')
  productionByMine(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.productionByMine(user.tenantId!, query);
  }

  @Get('production-by-shift')
  @RequirePermissions('analytics.read')
  productionByShift(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.productionByShift(user.tenantId!, query);
  }

  @Get('production-by-activity')
  @RequirePermissions('analytics.read')
  productionByActivity(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.productionByActivity(user.tenantId!, query);
  }

  @Get('equipment-performance')
  @RequirePermissions('analytics.read')
  equipmentPerformance(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.equipmentPerformance(user.tenantId!, query);
  }

  @Get('equipment-hours')
  @RequirePermissions('analytics.read')
  equipmentHours(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.equipmentHours(user.tenantId!, query);
  }

  @Get('crew-activity')
  @RequirePermissions('analytics.read')
  crewActivity(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.crewActivity(user.tenantId!, query);
  }

  @Get('reports')
  @RequirePermissions('analytics.read')
  reports(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.reports(user.tenantId!, query);
  }

  @Get('targets-vs-actual')
  @RequirePermissions('analytics.read')
  targetsVsActual(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.analytics.targetsVsActual(user.tenantId!, query);
  }

  @Get('export')
  @RequirePermissions('analytics.export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query('type') type: string,
    @Query('format') format: string,
    @Query() query: Record<string, any>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.analytics.export(user.tenantId!, type, format, query);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return new StreamableFile(result.buffer);
  }
}
