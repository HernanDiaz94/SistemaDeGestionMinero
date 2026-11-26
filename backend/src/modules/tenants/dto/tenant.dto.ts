import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ModuleKey, TenantStatus } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  @IsOptional()
  @IsArray()
  modules?: ModuleKey[];
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;
}

export class ToggleModuleDto {
  @IsEnum(ModuleKey)
  key: ModuleKey;

  @IsOptional()
  enabled?: boolean;
}

export class CreateSubscriptionDto {
  @IsString()
  plan: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  maxUsers?: number;

  @IsOptional()
  endDate?: string;
}
