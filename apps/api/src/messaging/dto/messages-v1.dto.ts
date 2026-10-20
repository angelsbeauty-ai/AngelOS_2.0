import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class ReactionDto {
  @IsString() @MaxLength(16) emoji!: string;
}

export class PushTokenDto {
  @IsString() @MaxLength(200) @Matches(/^(Expo|Exponent)PushToken\[[^\]]+\]$/) token!: string;
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
}
