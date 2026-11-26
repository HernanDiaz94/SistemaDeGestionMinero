import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ProductionCategory, TargetPeriod } from '@prisma/client';

export class CreateProductionUnitDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsEnum(ProductionCategory)
  category: ProductionCategory;

  @IsOptional()
  @IsNumber()
  factorToBaseUnit?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductionUnitDto extends PartialType(CreateProductionUnitDto) {}

export class CreateProductionIndicatorDto {
  @IsString()
  @IsNotEmpty()
  unitId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ProductionCategory)
  category: ProductionCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductionIndicatorDto extends PartialType(
  CreateProductionIndicatorDto,
) {}

export class CreateProductionTargetDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  @IsString()
  mineId?: string;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsString()
  @IsNotEmpty()
  indicatorId: string;

  @IsEnum(TargetPeriod)
  period: TargetPeriod;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  day?: number;

  @IsNumber()
  targetValue: number;
}

export class UpdateProductionTargetDto extends PartialType(CreateProductionTargetDto) {}

export class ProductionRecordsQueryDto {
  @IsOptional()
  @IsString()
  reportId?: string;

  @IsOptional()
  @IsString()
  indicatorId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  mineId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
