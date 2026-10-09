import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
export class UpdateAutomationRuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) delayMinutes?: number;
  @IsOptional() @IsString() messageTemplate?: string;
}

export class UpdateReminderDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(600) templateEn?: string;
  @IsOptional() @IsString() @MaxLength(600) templateJa?: string;
  @IsOptional() @IsString() @MaxLength(600) templateJaMeaning?: string;
}
