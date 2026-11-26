import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { EmployeeStatus, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  crewId?: string | null;

  @IsOptional()
  @IsString()
  shiftId?: string | null;

  @IsString()
  code: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsString()
  documentNumber: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  position: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  type?: EmploymentType;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsDateString()
  hiredAt?: string | null;

  @IsOptional()
  @IsObject()
  documents?: Record<string, any>;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  crewId?: string | null;

  @IsOptional()
  @IsString()
  shiftId?: string | null;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  company?: string | null;

  @IsOptional()
  @IsEnum(EmploymentType)
  type?: EmploymentType;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsDateString()
  hiredAt?: string | null;

  @IsOptional()
  @IsObject()
  documents?: Record<string, any> | null;
}
