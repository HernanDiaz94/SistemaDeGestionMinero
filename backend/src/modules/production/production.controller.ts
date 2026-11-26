import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import {
  CreateProductionIndicatorDto,
  CreateProductionTargetDto,
  CreateProductionUnitDto,
  UpdateProductionIndicatorDto,
  UpdateProductionTargetDto,
  UpdateProductionUnitDto,
} from './dto/production.dto';
import { ProductionService } from './production.service';

@ApiTags('production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  // Unidades -----------------------------------------------------------------

  @Get('units')
  @RequirePermissions('production.read')
  findAllUnits(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.production.findAllUnits(user.tenantId!, query);
  }

  @Get('units/compatible')
  @RequirePermissions('production.read')
  compatibleUnits(@CurrentUser() user: AuthUser, @Query('category') category?: string) {
    return this.production.compatibleUnits(user.tenantId!, category);
  }

  @Get('units/:id')
  @RequirePermissions('production.read')
  findOneUnit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.findOneUnit(user.tenantId!, id);
  }

  @Post('units')
  @RequirePermissions('production.create')
  createUnit(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductionUnitDto,
  ) {
    return this.production.createUnit(user.tenantId!, dto, user.userId);
  }

  @Patch('units/:id')
  @RequirePermissions('production.update')
  updateUnit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductionUnitDto,
  ) {
    return this.production.updateUnit(user.tenantId!, id, dto, user.userId);
  }

  @Delete('units/:id')
  @RequirePermissions('production.delete')
  removeUnit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.removeUnit(user.tenantId!, id, user.userId);
  }

  // Indicadores --------------------------------------------------------------

  @Get('indicators')
  @RequirePermissions('production.read')
  findAllIndicators(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.production.findAllIndicators(user.tenantId!, query);
  }

  @Get('indicators/:id')
  @RequirePermissions('production.read')
  findOneIndicator(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.findOneIndicator(user.tenantId!, id);
  }

  @Post('indicators')
  @RequirePermissions('production.create')
  createIndicator(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductionIndicatorDto,
  ) {
    return this.production.createIndicator(user.tenantId!, dto, user.userId);
  }

  @Patch('indicators/:id')
  @RequirePermissions('production.update')
  updateIndicator(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductionIndicatorDto,
  ) {
    return this.production.updateIndicator(user.tenantId!, id, dto, user.userId);
  }

  @Delete('indicators/:id')
  @RequirePermissions('production.delete')
  removeIndicator(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.removeIndicator(user.tenantId!, id, user.userId);
  }

  // Objetivos ----------------------------------------------------------------

  @Get('targets')
  @RequirePermissions('production.targets.read')
  findAllTargets(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.production.findAllTargets(user.tenantId!, query);
  }

  @Get('targets/:id')
  @RequirePermissions('production.targets.read')
  findOneTarget(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.findOneTarget(user.tenantId!, id);
  }

  @Post('targets')
  @RequirePermissions('production.targets.create')
  createTarget(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductionTargetDto,
  ) {
    return this.production.createTarget(user.tenantId!, dto, user.userId);
  }

  @Patch('targets/:id')
  @RequirePermissions('production.targets.update')
  updateTarget(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductionTargetDto,
  ) {
    return this.production.updateTarget(user.tenantId!, id, dto, user.userId);
  }

  @Delete('targets/:id')
  @RequirePermissions('production.targets.update')
  removeTarget(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.production.removeTarget(user.tenantId!, id, user.userId);
  }

  // Consultas ----------------------------------------------------------------

  @Get('records')
  @RequirePermissions('production.read')
  findAllRecords(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.production.findAllRecords(user.tenantId!, query);
  }

  @Get('summary')
  @RequirePermissions('production.read')
  summary(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.production.summary(user.tenantId!, query);
  }
}
