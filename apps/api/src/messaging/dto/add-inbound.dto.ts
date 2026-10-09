import { IsString, MaxLength, MinLength } from 'class-validator';

/** Paste the client's next message into an existing manual conversation. */
export class AddInboundDto {
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}
