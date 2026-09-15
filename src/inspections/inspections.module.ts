import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditAction, InspectionStatus, UserRole } from '../common/enums';
import { clientIp } from '../common/utils/request';
import { InspectionRecord } from '../records/entities/inspection-record.entity';
import { User } from '../users/entities/user.entity';
import { Inspection } from './entities/inspection.entity';

export class CreateInspectionDto {
  @ApiProperty({ example: 'Inspecção Geral do Parque Informático 2026' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: InspectionStatus })
  @IsOptional()
  @IsEnum(InspectionStatus)
  status?: InspectionStatus;
}

export class UpdateInspectionDto extends PartialType(CreateInspectionDto) {}

@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(Inspection) private readonly repo: Repository<Inspection>,
    @InjectRepository(InspectionRecord) private readonly records: Repository<InspectionRecord>,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const items = await this.repo.find({ order: { createdAt: 'DESC' } });
    const counts = await this.records
      .createQueryBuilder('r')
      .select('r.inspectionId', 'inspectionId')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('r.inspectionId')
      .getRawMany<{ inspectionId: string; count: number }>();
    const byId = new Map(counts.map((c) => [c.inspectionId, c.count]));
    return items.map((i) => ({ ...i, recordCount: byId.get(i.id) ?? 0 }));
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Inspecção não encontrada');
    return item;
  }

  /** Inspecção sugerida por omissão: a mais recente em curso, senão a mais recente. */
  async findCurrent() {
    return (
      (await this.repo.findOne({ where: { status: InspectionStatus.EM_CURSO }, order: { createdAt: 'DESC' } })) ??
      (await this.repo.findOne({ where: {}, order: { createdAt: 'DESC' } }))
    );
  }

  async create(dto: CreateInspectionDto, actorId: string, ip: string | null) {
    this.checkDates(dto.startDate, dto.endDate);
    if (await this.repo.exists({ where: { name: dto.name } })) {
      throw new ConflictException('Já existe uma inspecção com este nome');
    }
    const saved = await this.repo.save(this.repo.create(dto));
    await this.audit.log({ userId: actorId, action: AuditAction.CREATE, entity: 'inspection', entityId: saved.id, summary: `Inspecção criada: ${saved.name}`, ip });
    return saved;
  }

  async update(id: string, dto: UpdateInspectionDto, actorId: string, ip: string | null) {
    const item = await this.findOne(id);
    this.checkDates(dto.startDate ?? item.startDate, dto.endDate ?? item.endDate);
    Object.assign(item, dto);
    const saved = await this.repo.save(item);
    await this.audit.log({ userId: actorId, action: AuditAction.UPDATE, entity: 'inspection', entityId: id, summary: `Inspecção actualizada: ${saved.name}`, changes: { ...dto }, ip });
    return saved;
  }

  private checkDates(start?: string | null, end?: string | null) {
    if (start && end && new Date(end) < new Date(start)) {
      throw new BadRequestException('A data de fim não pode ser anterior à data de início');
    }
  }
}

@ApiTags('Inspecções')
@ApiBearerAuth('JWT')
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly service: InspectionsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('current')
  @ApiOperation({ summary: 'Inspecção seleccionada por omissão' })
  current() {
    return this.service.findCurrent();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateInspectionDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.create(dto, u.id, clientIp(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInspectionDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.update(id, dto, u.id, clientIp(req));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Inspection, InspectionRecord])],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}
