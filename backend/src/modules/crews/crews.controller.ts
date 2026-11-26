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
import { CrewsService } from './crews.service';
import { CreateCrewDto, UpdateCrewDto } from './dto/crews.dto';

@ApiTags('crews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('crews')
export class CrewsController {
  constructor(private readonly crews: CrewsService) {}

  @Get()
  @RequirePermissions('crews.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.crews.findAll(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions('crews.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCrewDto) {
    return this.crews.create(user.tenantId!, dto, user.userId);
  }

  @Get(':id')
  @RequirePermissions('crews.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crews.findOne(user.tenantId!, id);
  }

  @Patch(':id')
  @RequirePermissions('crews.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCrewDto,
  ) {
    return this.crews.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('crews.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.crews.remove(user.tenantId!, id, user.userId);
  }
}
