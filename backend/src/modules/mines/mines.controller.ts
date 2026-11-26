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
import { CreateMineDto, UpdateMineDto } from './dto/mines.dto';
import { MinesService } from './mines.service';

@ApiTags('mines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('mines')
export class MinesController {
  constructor(private readonly mines: MinesService) {}

  @Get()
  @RequirePermissions('mines.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.mines.findAll(user.tenantId!, query);
  }

  @Get('modes')
  @RequirePermissions('mines.read')
  modes() {
    return this.mines.modes();
  }

  @Post()
  @RequirePermissions('mines.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMineDto) {
    return this.mines.create(user.tenantId!, dto, user.userId);
  }

  @Get(':id')
  @RequirePermissions('mines.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mines.findOne(user.tenantId!, id);
  }

  @Patch(':id')
  @RequirePermissions('mines.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMineDto,
  ) {
    return this.mines.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('mines.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mines.remove(user.tenantId!, id, user.userId);
  }
}
