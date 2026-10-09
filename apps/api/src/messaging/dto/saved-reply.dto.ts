import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export const SAVED_REPLY_CATEGORIES = ['prices','directions','deposit','aftercare','cancellation','booking','follow_up','other'] as const;

export class CreateSavedReplyDto {
  @IsString() @Length(1, 80) title!: string;
  @IsOptional() @IsIn(SAVED_REPLY_CATEGORIES) category?: string;
  @IsOptional() @IsString() @MaxLength(2000) bodyEn?: string;
  @IsOptional() @IsString() @MaxLength(2000) bodyJa?: string;
}

export class UpdateSavedReplyDto {
  @IsOptional() @IsString() @Length(1, 80) title?: string;
  @IsOptional() @IsIn(SAVED_REPLY_CATEGORIES) category?: string;
  @IsOptional() @IsString() @MaxLength(2000) bodyEn?: string;
  @IsOptional() @IsString() @MaxLength(2000) bodyJa?: string;
}
