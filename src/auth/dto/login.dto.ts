import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'alfredo.nhancole@mdconsultores.co.mz' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(160)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Palavra-passe obrigatória' })
  @MaxLength(128)
  password: string;
}
