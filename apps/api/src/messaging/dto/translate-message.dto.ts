import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class TranslateMessageDto { @IsOptional() @IsIn(['en','ja']) targetLanguage?: 'en' | 'ja'; }

/** Translate text Angel is about to approve (e.g. an edited Japanese draft) so she can read it first. */
export class TranslateTextDto {
  @IsString() @MinLength(1) @MaxLength(5000) text!: string;
  @IsOptional() @IsIn(['en','ja']) targetLanguage?: 'en' | 'ja';
}
