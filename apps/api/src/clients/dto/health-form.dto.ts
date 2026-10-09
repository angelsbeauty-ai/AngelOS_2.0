import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateHealthFormDto {
  @IsObject() answers!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(160) signedName?: string;
}
