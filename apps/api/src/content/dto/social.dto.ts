import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCampaignDto {
  @IsString() @Length(1, 120) name!: string;
  @IsIn(['bookings', 'academy_students', 'trust', 'reach', 'touch_ups']) goal!: string;
  @Matches(DAY) startsOn!: string;
  @Matches(DAY) endsOn!: string;
  @IsOptional() @IsString() @MaxLength(300) offer?: string;
}

export class PlanDaysDto {
  @IsOptional() @Matches(DAY) startsOn?: string;
  @IsOptional() @IsInt() @Min(7) @Max(31) days?: number;
  @IsOptional() @IsInt() @Min(3) @Max(16) posts?: number;
}

export class MarkPostedDto {
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) permalink?: string;
}

export class LineBroadcastDto {
  @IsBoolean() confirm!: boolean;
}

export class HashtagSetDto {
  @IsString() @Length(1, 60) name!: string;
  @IsIn(['en', 'ja', 'both']) language!: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) tags!: string[];
}

export class LineDraftDto {
  @IsOptional() @IsString() @MaxLength(300) topic?: string;
  @IsOptional() @IsDateString() sendAt?: string;
}
