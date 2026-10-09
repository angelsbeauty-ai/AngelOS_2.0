import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTreatmentDto {
  @IsString() @MaxLength(160) serviceName!: string;
  @IsOptional() @IsIn(['first_session','touch_up','correction','cover_up','other']) stage?: string;
  @IsOptional() @IsString() @MaxLength(160) technique?: string;
  @IsOptional() @IsDateString() performedAt?: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsString() @MaxLength(120) area?: string;
  @IsOptional() @IsString() @MaxLength(300) pigments?: string;
  @IsOptional() @IsString() @MaxLength(120) needle?: string;
  @IsOptional() @IsString() @MaxLength(160) numbing?: string;
  @IsOptional() @IsString() @MaxLength(500) reaction?: string;
}
