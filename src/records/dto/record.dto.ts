import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  BatteryStatus,
  EquipmentCondition,
  EquipmentType,
  EsetStatus,
  ProblemType,
  RecordStatus,
  StorageType,
  UpdatesStatus,
} from '../../common/enums';

// Lê o valor original (obj[key]): com enableImplicitConversion, `value` já chega
// convertido e "false" transformar-se-ia em true.
const toBool = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const raw = obj[key];
  return raw === 'true' || raw === true ? true : raw === 'false' || raw === false ? false : raw;
};

/**
 * Validação de tipos e tamanhos. As regras condicionais (obrigatórios por tipo,
 * incompatibilidades, duplicados) estão em equipment-rules.ts.
 */
export class EquipmentDto {
  @ApiPropertyOptional({ description: 'Presente ao editar um equipamento existente' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ enum: EquipmentType })
  @IsEnum(EquipmentType, { message: 'Tipo de equipamento inválido' })
  type: EquipmentType;

  @IsOptional() @IsString() @MaxLength(200) otherDescription?: string | null;
  @IsOptional() @IsString() @MaxLength(200) brand?: string | null;
  @IsOptional() @IsString() @MaxLength(200) model?: string | null;
  @IsOptional() @IsString() @MaxLength(200) serialNumber?: string | null;
  @IsOptional() @IsBoolean() serialUnavailable?: boolean | null;
  @IsOptional() @IsString() @MaxLength(200) assetTag?: string | null;
  @IsOptional() @IsString() @MaxLength(200) processor?: string | null;
  @IsOptional() @IsNumber({}, { message: 'Memória RAM deve ser numérica' }) ramGb?: number | null;

  @ApiPropertyOptional({ enum: StorageType })
  @IsOptional() @IsEnum(StorageType) storageType?: StorageType | null;

  @IsOptional() @IsNumber({}, { message: 'Capacidade deve ser numérica' }) storageCapacityGb?: number | null;
  @IsOptional() @IsString() @MaxLength(200) operatingSystem?: string | null;
  @IsOptional() @IsString() @MaxLength(200) hostname?: string | null;
  @IsOptional() @IsString() @MaxLength(100) ipAddress?: string | null;
  @IsOptional() @IsNumber({}, { message: 'Tamanho deve ser numérico' }) screenSizeInches?: number | null;

  @ApiPropertyOptional({ enum: EquipmentCondition })
  @IsOptional() @IsEnum(EquipmentCondition) condition?: EquipmentCondition | null;

  @IsOptional() @IsString() @MaxLength(4000) conditionNotes?: string | null;

  @ApiPropertyOptional({ enum: BatteryStatus })
  @IsOptional() @IsEnum(BatteryStatus) batteryStatus?: BatteryStatus | null;

  @ApiPropertyOptional({ enum: ProblemType, isArray: true })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsEnum(ProblemType, { each: true })
  problems?: ProblemType[] | null;

  @IsOptional() @IsString() @MaxLength(4000) problemDescription?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) observations?: string | null;

  @ApiPropertyOptional({ enum: UpdatesStatus })
  @IsOptional() @IsEnum(UpdatesStatus) updatesStatus?: UpdatesStatus | null;

  @ApiPropertyOptional({ enum: EsetStatus })
  @IsOptional() @IsEnum(EsetStatus) esetStatus?: EsetStatus | null;

  @IsOptional() @IsString() @MaxLength(4000) appIssues?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) softwareNotes?: string | null;
  @IsOptional() @IsBoolean() softwareVerified?: boolean | null;
  @IsOptional() @IsBoolean() needsMaintenance?: boolean | null;
  @IsOptional() @IsBoolean() needsReplacement?: boolean | null;
}

class EquipmentListDto {
  @ApiProperty({ type: [EquipmentDto] })
  @IsArray()
  @ArrayMaxSize(40, { message: 'Máximo de 40 equipamentos por formulário' })
  @ValidateNested({ each: true })
  @Type(() => EquipmentDto)
  equipment: EquipmentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  generalNotes?: string | null;
}

export class CreateRecordDto extends EquipmentListDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Inspecção inválida' })
  inspectionId: string;

  @ApiProperty()
  @IsUUID('4', { message: 'Seleccione o colaborador' })
  collaboratorId: string;

  @ApiProperty({ description: 'true = submeter (validação completa); false = guardar rascunho' })
  @IsBoolean()
  submit: boolean;
}

export class UpdateRecordDto extends EquipmentListDto {
  @ApiProperty({ description: 'true = submeter (validação completa); false = guardar rascunho' })
  @IsBoolean()
  submit: boolean;
}

export class ValidateRecordDto extends EquipmentListDto {
  @ApiProperty()
  @IsUUID()
  inspectionId: string;

  @ApiPropertyOptional({ description: 'Registo em edição (excluído da verificação de duplicados)' })
  @IsOptional()
  @IsUUID()
  recordId?: string;
}

export class ReviewRecordDto {
  @ApiProperty({ enum: ['validar', 'corrigir'] })
  @IsIn(['validar', 'corrigir'])
  decision: 'validar' | 'corrigir';

  @ApiPropertyOptional({ description: 'Obrigatório ao pedir correcção' })
  @ValidateIf((o: ReviewRecordDto) => o.decision === 'corrigir' || o.comment !== undefined)
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class RecordQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() inspectionId?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional() @IsEnum(RecordStatus) status?: RecordStatus;

  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() createdById?: string;

  @ApiPropertyOptional({ enum: EquipmentType, description: 'Formulários que incluem este tipo' })
  @IsOptional() @IsEnum(EquipmentType) equipmentType?: EquipmentType;

  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() hasProblems?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() incomplete?: boolean;
}

export class EquipmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() inspectionId?: string;

  @ApiPropertyOptional({ enum: EquipmentType })
  @IsOptional() @IsEnum(EquipmentType) type?: EquipmentType;

  @ApiPropertyOptional({ enum: EquipmentCondition })
  @IsOptional() @IsEnum(EquipmentCondition) condition?: EquipmentCondition;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional() @IsEnum(RecordStatus) recordStatus?: RecordStatus;

  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() collaboratorId?: string;

  @ApiPropertyOptional({ enum: ProblemType })
  @IsOptional() @IsEnum(ProblemType) problem?: ProblemType;

  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() hasProblems?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() missingSerial?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() incomplete?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() needsMaintenance?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() needsReplacement?: boolean;
}
