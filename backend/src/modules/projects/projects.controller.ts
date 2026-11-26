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
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermissions('projects.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: any) {
    return this.projects.findAll(user.tenantId!, query);
  }

  @Post()
  @RequirePermissions('projects.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.tenantId!, dto, user.userId);
  }

  @Get(':id/mines')
  @RequirePermissions('mines.read')
  mines(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() query: any) {
    return this.projects.findMines(user.tenantId!, id, query);
  }

  @Get(':id/stats')
  @RequirePermissions('projects.read')
  stats(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.stats(user.tenantId!, id);
  }

  @Get(':id')
  @RequirePermissions('projects.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.findOne(user.tenantId!, id);
  }

  @Patch(':id')
  @RequirePermissions('projects.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('projects.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.remove(user.tenantId!, id, user.userId);
  }
}
