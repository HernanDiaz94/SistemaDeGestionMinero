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
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employees.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions('employees.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.employees.findAll(user.tenantId!, query);
  }

  @Get('stats')
  @RequirePermissions('employees.read')
  stats(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.employees.stats(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions('employees.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user.tenantId!, dto, user.userId);
  }

  @Get(':id')
  @RequirePermissions('employees.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employees.findOne(user.tenantId!, id);
  }

  @Patch(':id')
  @RequirePermissions('employees.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('employees.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employees.remove(user.tenantId!, id, user.userId);
  }
}
