import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const PASTE_PLATFORMS = ['line', 'instagram', 'facebook', 'other'] as const;

/** "+ New conversation": Angel picks a client and pastes the message the client sent her. */
export class StartConversationDto {
  @IsUUID() clientId!: string;
  @IsIn(PASTE_PLATFORMS) platform!: (typeof PASTE_PLATFORMS)[number];
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}
