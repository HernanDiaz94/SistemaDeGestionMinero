import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/interfaces';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/permissions.guard';
import { TenantGuard } from '../../common/auth/tenant.guard';
import {
  ApproveReportDto,
  CreateReportDto,
  RejectReportDto,
  ReviewReportDto,
  UpdateReportDto,
} from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions('reports.read')
  findAll(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.reports.findAll(user.tenantId!, query);
  }

  /** Clave completa codificada en un único segmento (ej. tenant%2Freports%2Farchivo.png). */
  @Get('files/:key')
  @RequirePermissions('reports.read')
  downloadFile(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.reports.serveFile(user.tenantId!, key, res);
  }

  /** Clave sin codificar: /api/files/<tenantId>/reports/<archivo>. */
  @Get('files/*key')
  @RequirePermissions('reports.read')
  downloadNestedFile(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string | string[],
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.reports.serveFile(user.tenantId!, key as string, res);
  }

  @Get(':id/revisions')
  @RequirePermissions('reports.read')
  findRevisions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.findRevisions(user.tenantId!, id);
  }

  @Get(':id/attachments')
  @RequirePermissions('reports.read')
  listAttachments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.listAttachments(user.tenantId!, id);
  }

  @Post(':id/attachments')
  @RequirePermissions('reports.update')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.reports.addAttachment(user.tenantId!, id, file, user.userId);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequirePermissions('reports.update')
  removeAttachment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.reports.removeAttachment(user.tenantId!, id, attachmentId, user.userId);
  }

  @Get(':id/export/csv')
  @RequirePermissions('reports.export')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.reports.exportCsv(user.tenantId!, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="parte-${id}.csv"`);
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get(':id')
  @RequirePermissions('reports.read')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.findOne(user.tenantId!, id);
  }

  @Post()
  @RequirePermissions('reports.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.create(user.tenantId!, dto, user.userId);
  }

  @Patch(':id')
  @RequirePermissions('reports.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reports.update(user.tenantId!, id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermissions('reports.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.remove(user.tenantId!, id, user.userId);
  }

  @Post(':id/submit')
  @RequirePermissions('reports.submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.submit(user.tenantId!, id, user.userId);
  }

  @Post(':id/review')
  @RequirePermissions('reports.review')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
  ) {
    return this.reports.review(user.tenantId!, id, dto, user.userId);
  }

  @Post(':id/approve')
  @RequirePermissions('reports.approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ApproveReportDto,
  ) {
    return this.reports.approve(user.tenantId!, id, dto, user.userId);
  }

  @Post(':id/reject')
  @RequirePermissions('reports.approve')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectReportDto,
  ) {
    return this.reports.reject(user.tenantId!, id, dto, user.userId);
  }
}
