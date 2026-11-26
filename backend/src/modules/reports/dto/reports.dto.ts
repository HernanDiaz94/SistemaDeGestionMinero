import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AttachmentKind, ReportStatus } from '@prisma/client';

export class CreateActivityDto {
  @IsOptional()
  @IsString()
  areaId?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endAt?: Date;

  @IsOptional()
  @IsNumber()
  hours?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProductionDto {
  @IsString()
  @IsNotEmpty()
  indicatorId: string;

  @IsString()
  @IsNotEmpty()
  unitId: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReportEmployeeDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsOptional()
  @IsNumber()
  hours?: number;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReportEquipmentDto {
  @IsString()
  @IsNotEmpty()
  equipmentId: string;

  @IsOptional()
  @IsNumber()
  hours?: number;

  @IsOptional()
  @IsNumber()
  fuelLiters?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  mineId: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  supervisorUserId?: string;

  @IsOptional()
  @IsString()
  supervisorEmployeeId?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateActivityDto)
  activities?: CreateActivityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductionDto)
  production?: CreateProductionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReportEmployeeDto)
  employees?: CreateReportEmployeeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReportEquipmentDto)
  equipment?: CreateReportEquipmentDto[];
}

export class UpdateReportDto extends PartialType(CreateReportDto) {
  /** Obligatorio al rectificar un parte ya aprobado. */
  @IsOptional()
  @IsString()
  rectificationReason?: string;

  @IsOptional()
  @IsString()
  updateReason?: string;
}

export class ReviewReportDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class ApproveReportDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class RejectReportDto {
  @IsString()
  @IsNotEmpty()
  comments: string;
}

export class AttachmentKindDto {
  @IsEnum(AttachmentKind)
  @IsOptional()
  kind?: AttachmentKind;
}

export class ReportsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  mineId?: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
