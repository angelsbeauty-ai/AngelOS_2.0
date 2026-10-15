import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CONTENT_OBJECTIVES } from './create-composer-draft.dto';
import { CAPTION_TONES } from '../caption-draft';

export class ComposeCaptionDto {
  @IsIn(CONTENT_OBJECTIVES) objective!: string;
  @IsIn(['en', 'ja', 'both']) language!: 'en' | 'ja' | 'both';
  @IsOptional() @IsIn(CAPTION_TONES) tone?: string;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() @MaxLength(5000) caption?: string;
  @IsOptional() @IsString() @MaxLength(5000) captionEn?: string;
  @IsOptional() @IsInt() @Min(0) @Max(20) seed?: number;
}
