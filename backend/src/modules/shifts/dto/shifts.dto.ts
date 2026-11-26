import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { EmployeeStatus, ShiftType } from '@prisma/client';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateShiftDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(ShiftType)
  type?: ShiftType;

  @Matches(TIME_PATTERN, { message: 'startTime debe tener formato HH:mm' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'endTime debe tener formato HH:mm' })
  endTime: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  projectId?: string | null;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ShiftType)
  type?: ShiftType;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'startTime debe tener formato HH:mm' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'endTime debe tener formato HH:mm' })
  endTime?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  projectId?: string | null;
}
