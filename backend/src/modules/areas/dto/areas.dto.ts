import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AreaType, EmployeeStatus } from '@prisma/client';

export class CreateAreaDto {
  @IsString()
  mineId: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(AreaType)
  type: AreaType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  mineId?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AreaType)
  type?: AreaType;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}
