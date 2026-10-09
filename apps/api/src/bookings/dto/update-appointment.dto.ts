import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(0) depositAmount?: number | null;
  @IsOptional() @IsIn(['cash', 'card', 'paypay', 'bank_transfer', 'other']) depositMethod?: string | null;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsInt() @Min(5) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(240) bufferBeforeMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(240) bufferAfterMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) standardPrice?: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsNumber() @Min(0) depositAmount?: number | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
