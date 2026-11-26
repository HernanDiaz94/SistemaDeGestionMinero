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
  CreateEquipmentCategoryDto,
  CreateEquipmentDto,
  CreateEquipmentReadingDto,
  CreateFuelRecordDto,
  UpdateEquipmentCategoryDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import { EquipmentService } from './equipment.service';

@ApiTags('equipment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  // Categorías (rutas estáticas antes de /:id)
  @Get('categories')
  @RequirePermissions('equipment.read')
  findAllCategories(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.equipment.findAllCategories(user.tenantId!, query);
  }

  @Post('categories')
  @RequirePermissions('equipment.create')
  createCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateEquipmentCategoryDto) {
    return this.equipment.createCategory(user.tenantId!, dto, user.userId);
  }

  @Get('categories/:id')
  @RequirePermissions('equipment.read')
  findOneCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.equipment.findOneCategory(user.tenantId!, id);
  }

  @Patch('categories/:id')
  @RequirePermissions('equipment.update')
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentCategoryDto,
  ) {
    return this.equipment.updateCategory(user.tenantId!, id, dto, user.userId);
  }

  @Delete('categories/:id')
  @RequirePermissions('equipment.delete')
  removeCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.equipment.removeCategory(user.tenantId!, id, user.userId);
  }

  @Get('stats')
  @RequirePermissions('equipment.read')
  stats(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.equipment.stats(user.tenantId!, query);
  }

  // Equipos
  @Get()
  @RequirePermissions('equipment.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.equipment.findAll(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions('equipment.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEquipmentDto) {
    return this.equipment.create(user.tenantId!, dto, user.userId);
  }

  @Get(':id/readings')
  @RequirePermissions('equipment.read')
  findReadings(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: any,
  ) {
    return this.equipment.findReadings(user.tenantId!, id, query);
  }

  @Post(':id/readings')
  @RequirePermissions('equipment.readings.create')
  createReading(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateEquipmentReadingDto,
  ) {
    return this.equipment.createReading(user.tenantId!, id, dto, user.userId);
  }

  @Get(':id/fuel')
  @RequirePermissions('equipment.read')
  findFuel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: any,
  ) {
    return this.equipment.findFuel(user.tenantId!, id, query);
  }

  @Post(':id/fuel')
  @RequirePermissions('equipment.fuel.create')
  createFuel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateFuelRecordDto,
  ) {
    return this.equipment.createFuel(user.tenantId!, id, dto, user.userId);
  }

  @Get(':id')
  @RequirePermissions('equipment.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.equipment.findOne(user.tenantId!, id);
  }

  @Patch(':id')
  @RequirePermissions('equipment.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.equipment.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('equipment.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.equipment.remove(user.tenantId!, id, user.userId);
  }
}
