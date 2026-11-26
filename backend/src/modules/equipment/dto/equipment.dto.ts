import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EquipmentStatus } from '@prisma/client';

export class CreateEquipmentCategoryDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateEquipmentCategoryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

export class CreateEquipmentDto {
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  responsibleId?: string | null;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  operatingHours?: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  responsibleId?: string | null;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsString()
  model?: string | null;

  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  operatingHours?: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateEquipmentReadingDto {
  @IsOptional()
  @IsDateString()
  readAt?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hours: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateFuelRecordDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  liters: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  station?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
