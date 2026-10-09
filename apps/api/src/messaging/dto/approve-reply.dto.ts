import { IsOptional, IsString, MaxLength } from 'class-validator';
/** Optional edited text: Angel can change the AI draft before tapping Approve. */
export class ApproveReplyDto { @IsOptional() @IsString() @MaxLength(5000) body?: string; }
