import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditAction, UserRole } from '../common/enums';
import { clientIp } from '../common/utils/request';
import { User } from '../users/entities/user.entity';
import { EquipmentCategory } from './entities/equipment-category.entity';

export class CreateEquipmentCategoryDto {
  @ApiProperty({ example: 'Impressora' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 'Impressora ou multifunções' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string | null;

  @ApiPropertyOptional({ example: 'tablet' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/, { message: 'Ícone inválido' })
  icon?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEquipmentCategoryDto extends PartialType(CreateEquipmentCategoryDto) {}

@Injectable()
export class EquipmentCategoriesService {
  constructor(
    @InjectRepository(EquipmentCategory) private readonly repo: Repository<EquipmentCategory>,
    private readonly audit: AuditService,
  ) {}

  findAll(includeInactive = false) {
    return this.repo.find({ where: includeInactive ? {} : { isActive: true }, order: { name: 'ASC' } });
  }

  async create(dto: CreateEquipmentCategoryDto, actorId: string, ip: string | null) {
    await this.ensureUnique(dto.name);
    const saved = await this.repo.save(this.repo.create({ ...dto, createdById: actorId }));
    await this.audit.log({ userId: actorId, action: AuditAction.CREATE, entity: 'equipment_category', entityId: saved.id, summary: `Equipamento adicionado ao catálogo: ${saved.name}`, ip });
    return saved;
  }

  async update(id: string, dto: UpdateEquipmentCategoryDto, actorId: string, ip: string | null) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Equipamento não encontrado no catálogo');
    if (dto.name && dto.name.toLowerCase() !== cat.name.toLowerCase()) await this.ensureUnique(dto.name);
    Object.assign(cat, dto);
    const saved = await this.repo.save(cat);
    await this.audit.log({ userId: actorId, action: AuditAction.UPDATE, entity: 'equipment_category', entityId: id, summary: `Catálogo de equipamentos actualizado: ${saved.name}`, changes: { ...dto }, ip });
    return saved;
  }

  /** Os equipamentos já registados guardam o nome, por isso eliminar do catálogo não os afecta. */
  async remove(id: string, actorId: string, ip: string | null) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Equipamento não encontrado no catálogo');
    await this.repo.delete(id);
    await this.audit.log({ userId: actorId, action: AuditAction.DELETE, entity: 'equipment_category', entityId: id, summary: `Equipamento removido do catálogo: ${cat.name}`, ip });
    return { ok: true };
  }

  private async ensureUnique(name: string) {
    const exists = await this.repo.createQueryBuilder('c').where('LOWER(c.name) = LOWER(:name)', { name }).getExists();
    if (exists) throw new ConflictException('Já existe um equipamento com este nome no catálogo');
  }
}

@ApiTags('Catálogo de equipamentos')
@ApiBearerAuth('JWT')
@Controller('equipment-categories')
export class EquipmentCategoriesController {
  constructor(private readonly service: EquipmentCategoriesService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  /** Aberto a técnicos: quem faz a recolha pode adicionar equipamentos que faltem no catálogo. */
  @Post()
  create(@Body() dto: CreateEquipmentCategoryDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.create(dto, u.id, clientIp(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEquipmentCategoryDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.update(id, dto, u.id, clientIp(req));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.remove(id, u.id, clientIp(req));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentCategory])],
  controllers: [EquipmentCategoriesController],
  providers: [EquipmentCategoriesService],
})
export class EquipmentCategoriesModule {}
