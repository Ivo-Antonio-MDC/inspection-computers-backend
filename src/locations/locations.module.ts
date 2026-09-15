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
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditAction, LocationModality, UserRole } from '../common/enums';
import { clientIp } from '../common/utils/request';
import { User } from '../users/entities/user.entity';
import { Location } from './entities/location.entity';

export class CreateLocationDto {
  @ApiProperty({ example: 'Maputo — Sede' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: LocationModality })
  @IsEnum(LocationModality)
  modality: LocationModality;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location) private readonly repo: Repository<Location>,
    @InjectRepository(Collaborator) private readonly collaborators: Repository<Collaborator>,
    private readonly audit: AuditService,
  ) {}

  findAll(includeInactive = false) {
    return this.repo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { modality: 'ASC', name: 'ASC' },
    });
  }

  async create(dto: CreateLocationDto, actorId: string, ip: string | null) {
    await this.ensureUnique(dto.name);
    const saved = await this.repo.save(this.repo.create(dto));
    await this.audit.log({ userId: actorId, action: AuditAction.CREATE, entity: 'location', entityId: saved.id, summary: `Localização criada: ${saved.name}`, ip });
    return saved;
  }

  async update(id: string, dto: UpdateLocationDto, actorId: string, ip: string | null) {
    const loc = await this.repo.findOne({ where: { id } });
    if (!loc) throw new NotFoundException('Localização não encontrada');
    if (dto.name && dto.name.toLowerCase() !== loc.name.toLowerCase()) await this.ensureUnique(dto.name);
    Object.assign(loc, dto);
    const saved = await this.repo.save(loc);
    await this.audit.log({ userId: actorId, action: AuditAction.UPDATE, entity: 'location', entityId: id, summary: `Localização actualizada: ${saved.name}`, changes: { ...dto }, ip });
    return saved;
  }

  async remove(id: string, actorId: string, ip: string | null) {
    const loc = await this.repo.findOne({ where: { id } });
    if (!loc) throw new NotFoundException('Localização não encontrada');
    if (await this.collaborators.exists({ where: { locationId: id } })) {
      throw new ConflictException('A localização tem colaboradores associados — desactive-a em vez de a eliminar');
    }
    await this.repo.delete(id);
    await this.audit.log({ userId: actorId, action: AuditAction.DELETE, entity: 'location', entityId: id, summary: `Localização eliminada: ${loc.name}`, ip });
    return { ok: true };
  }

  private async ensureUnique(name: string) {
    const exists = await this.repo.createQueryBuilder('l').where('LOWER(l.name) = LOWER(:name)', { name }).getExists();
    if (exists) throw new ConflictException('Já existe uma localização com este nome');
  }
}

@ApiTags('Localizações')
@ApiBearerAuth('JWT')
@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateLocationDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.create(dto, u.id, clientIp(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.update(id, dto, u.id, clientIp(req));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.remove(id, u.id, clientIp(req));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Location, Collaborator])],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
