import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const CONTENT_OBJECTIVES = ['reach','engagement','saves','profile_visits','inquiries','bookings','education','trust','availability'] as const;
export const COMPOSER_PLATFORMS = ['instagram','facebook','tiktok','line','manual'] as const;
export const CONTENT_FORMATS = ['reel','story','carousel','photo'] as const;

/** Owner-written post from the composer: the caption is Angel's own text, media is optional. */
export class CreateComposerDraftDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsIn(CONTENT_OBJECTIVES) objective!: string;
  @IsOptional() @IsString() @MaxLength(500) goal?: string;
  @IsIn(['en','ja','both']) language!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) caption!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) hashtags?: string[];
  @IsIn(CONTENT_FORMATS) format!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsIn(COMPOSER_PLATFORMS, { each: true }) platforms!: string[];
  @IsOptional() @IsDateString() plannedFor?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID('4', { each: true }) mediaAssetIds?: string[];
}
