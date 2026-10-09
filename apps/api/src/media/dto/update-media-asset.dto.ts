import { IsIn, IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class UpdateMediaAssetDto {
  @IsOptional() @IsIn(['unknown','private','treatment_only','marketing_approved','limited']) marketingPermission?: string;
  @IsOptional() @IsObject() marketingScope?: Record<string, unknown>;
  @IsOptional() @IsIn(['unused','reviewed','selected','ready','posted','archived']) contentStatus?: string;
  @IsOptional() @IsIn(['active','archived']) lifecycleStatus?: string;
  @IsOptional() @IsIn(['before','after','healed','touch_up','client_submitted','consultation','content_source','document','other']) role?: string;
  /** Link to a client; null removes the client link. */
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsUUID() clientId?: string | null;
}
