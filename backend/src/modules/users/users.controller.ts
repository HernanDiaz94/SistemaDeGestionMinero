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
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.users.findAll(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions('users.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.tenantId!, dto, user.userId);
  }

  @Get(':id')
  @RequirePermissions('users.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.findOne(user.tenantId!, id);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.remove(user.tenantId!, id, user.userId);
  }
}
