import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { TenantsService } from './tenants.service';
import {
  CreateSubscriptionDto,
  CreateTenantDto,
  ToggleModuleDto,
  UpdateTenantDto,
} from './dto/tenant.dto';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @RequirePermissions('tenants.read')
  findAll(@Query() query: any) {
    return this.tenants.findAll(query);
  }

  @Post()
  @RequirePermissions('tenants.create')
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthUser) {
    return this.tenants.create(dto, user.userId);
  }

  @Get('permissions')
  @RequirePermissions('roles.read')
  listPermissions() {
    return this.tenants.listPermissions();
  }

  @Post('seed-system')
  @RequirePermissions('tenants.create')
  seedSystem() {
    return this.tenants.seedRoles();
  }

  @Get(':id')
  @RequirePermissions('settings.read')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenants.findOneForUser(id, user);
  }

  @Patch(':id')
  @RequirePermissions('settings.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.tenants.findOneForUser(id, user);
    return this.tenants.update(id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('tenants.delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenants.remove(id, user.userId);
  }

  @Get(':id/modules')
  @RequirePermissions('settings.read')
  async modules(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.tenants.findOneForUser(id, user);
    return this.tenants.listModules(id);
  }

  @Put(':id/modules')
  @RequirePermissions('settings.update')
  async toggleModule(
    @Param('id') id: string,
    @Body() dto: ToggleModuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.tenants.findOneForUser(id, user);
    return this.tenants.toggleModule(id, dto);
  }

  @Post(':id/subscriptions')
  @RequirePermissions('settings.update')
  async subscription(
    @Param('id') id: string,
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.tenants.findOneForUser(id, user);
    return this.tenants.createSubscription(id, dto);
  }

  @Get(':id/roles')
  @RequirePermissions('roles.read')
  async roles(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.tenants.findOneForUser(id, user);
    return this.tenants.listRoles(id);
  }

  @Post(':id/users/:tenantUserId/roles')
  @RequirePermissions('users.update')
  async assignRole(
    @Param('id') id: string,
    @Param('tenantUserId') tenantUserId: string,
    @Body() body: { roleKey: string },
    @CurrentUser() user: AuthUser,
  ) {
    await this.tenants.findOneForUser(id, user);
    return this.tenants.assignRole(id, tenantUserId, body.roleKey);
  }
}
