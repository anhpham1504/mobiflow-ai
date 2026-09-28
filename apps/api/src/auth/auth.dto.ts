import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@mobiflow.local', maxLength: 254 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: String, minLength: 8, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class SafeUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['USER', 'STAFF', 'MANAGER'] }) role!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty() available!: boolean;
}

export class AuthResultDto {
  @ApiProperty({ description: 'Short-lived bearer JWT. Keep in browser memory only.' }) accessToken!: string;
  @ApiProperty({ example: 900 }) expiresIn!: number;
  @ApiProperty({ type: SafeUserDto }) user!: SafeUserDto;
}

export class AuthEnvelopeDto {
  @ApiProperty({ type: AuthResultDto }) data!: AuthResultDto;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
}

export class SafeUserEnvelopeDto {
  @ApiProperty({ type: SafeUserDto }) data!: SafeUserDto;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
}
