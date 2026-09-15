import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RecordStatus } from '../../common/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

/** TR §7.1 — Identificação do utilizador */
export class CreateCollaboratorDto {
  @ApiProperty({ example: 'Maria Joaquina Cossa' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'O nome deve ter pelo menos 3 caracteres' })
  @MaxLength(160)
  name: string;

  @ApiProperty()
  @IsUUID('4', { message: 'Seleccione o departamento' })
  departmentId: string;

  @ApiProperty()
  @IsUUID('4', { message: 'Seleccione a localização' })
  locationId: string;

  @ApiProperty({ example: 'Técnica de Contabilidade' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Indique o cargo/função' })
  @MaxLength(120)
  position: string;
}

export class UpdateCollaboratorDto extends PartialType(CreateCollaboratorDto) {}

export class CollaboratorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'Inclui o estado do formulário nesta inspecção' })
  @IsOptional()
  @IsUUID()
  inspectionId?: string;

  @ApiPropertyOptional({
    description: 'Filtra pelo estado do formulário na inspecção; "sem_registo" = ainda não inspeccionado',
  })
  @IsOptional()
  @IsEnum({ ...RecordStatus, SEM_REGISTO: 'sem_registo' })
  recordStatus?: RecordStatus | 'sem_registo';
}
