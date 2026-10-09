import { IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateReplyStyleDto {
  @IsOptional() @IsBoolean() learnFromReplies?: boolean;
  @IsOptional() @IsIn(['casual_friendly', 'warm_polite', 'professional', 'playful']) replyTone?: string;
  @IsOptional() @IsIn(['none', 'light', 'lots']) emojiLevel?: string;
  @IsOptional() @IsIn(['short', 'medium', 'detailed']) replyLength?: string;
  @IsOptional() @IsString() @MaxLength(1000) styleNotes?: string;
}

/** Angel can tidy a suggested repeated reply before approving it. */
export class ApproveSuggestedReplyDto {
  @IsOptional() @IsString() @Length(1, 80) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) bodyEn?: string;
  @IsOptional() @IsString() @MaxLength(2000) bodyJa?: string;
}
