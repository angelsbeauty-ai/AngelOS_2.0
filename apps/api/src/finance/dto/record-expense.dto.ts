import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class RecordExpenseDto {
  @IsNumber() @Min(1) @Max(100000000) amount!: number;
  @IsIn(['supplies', 'rent', 'marketing', 'education', 'equipment', 'fees', 'other']) category!: string;
  @IsOptional() @IsIn(['cash', 'card', 'paypay', 'bank_transfer', 'other']) method?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsString() @MaxLength(120) idempotencyKey?: string;
}
