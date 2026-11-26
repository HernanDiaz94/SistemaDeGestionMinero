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
import { CreateShiftDto, UpdateShiftDto } from './dto/shifts.dto';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  @RequirePermissions('shifts.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.shifts.findAll(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions('shifts.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateShiftDto) {
    return this.shifts.create(user.tenantId!, dto, user.userId);
  }

  @Get(':id')
  @RequirePermissions('shifts.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shifts.findOne(user.tenantId!, id);
  }

  @Patch(':id')
  @RequirePermissions('shifts.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shifts.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('shifts.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shifts.remove(user.tenantId!, id, user.userId);
  }
}
