import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReplyDto {
  @IsString() @MaxLength(5000) body!: string;
  /** M51: the message this reply quotes. */
  @IsOptional() @IsUUID() replyToMessageId?: string;
  /** M20: a photo from the media library (angelos-media) to send with the reply. */
  @IsOptional() @IsUUID() attachmentAssetId?: string;
  @IsOptional() @IsBoolean() sendNow?: boolean;
  @IsOptional() @IsIn(['faq','booking_confirmation','appointment_reminder','aftercare','follow_up'])
  routineCategory?: 'faq' | 'booking_confirmation' | 'appointment_reminder' | 'aftercare' | 'follow_up';
}
