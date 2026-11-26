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
import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/areas.dto';

@ApiTags('areas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  @RequirePermissions('areas.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.areas.findAll(user.tenantId!, query);
  }

  @Get('tree')
  @RequirePermissions('areas.read')
  tree(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.areas.tree(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions('areas.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAreaDto) {
    return this.areas.create(user.tenantId!, dto, user.userId);
  }

  @Get(':id')
  @RequirePermissions('areas.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.areas.findOne(user.tenantId!, id);
  }

  @Patch(':id')
  @RequirePermissions('areas.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAreaDto,
  ) {
    return this.areas.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('areas.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.areas.remove(user.tenantId!, id, user.userId);
  }
}
