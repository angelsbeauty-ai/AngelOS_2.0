import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
export class CourseDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsBoolean() published?: boolean;
}
export class LessonDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string | null;
  @IsOptional() @IsString() @MaxLength(500) @Matches(/^(https:\/\/.+)?$/) videoUrl?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true }) checklist?: string[];
}
export class ReorderDto { @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true }) lessonIds!: string[]; }
export class EnrollDto { @IsUUID() userId!: string; }
export class ProgressDto {
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsInt({ each: true }) checklistDone?: number[];
  @IsOptional() @IsBoolean() done?: boolean;
}
export class SubmissionDto {
  @IsOptional() @IsString() @MaxLength(7_500_000) photoBase64?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class ReviewDto {
  @IsIn(['approved', 'try_again']) status!: 'approved' | 'try_again';
  @IsOptional() @IsString() @MaxLength(2000) feedback?: string;
}
export class StudentInviteDto {
  @IsOptional() @IsString() @MaxLength(120) label?: string;
}
