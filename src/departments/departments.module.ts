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
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditAction, UserRole } from '../common/enums';
import { clientIp } from '../common/utils/request';
import { User } from '../users/entities/user.entity';
import { Department } from './entities/department.entity';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Recursos Humanos' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department) private readonly repo: Repository<Department>,
    @InjectRepository(Collaborator) private readonly collaborators: Repository<Collaborator>,
    private readonly audit: AuditService,
  ) {}

  findAll(includeInactive = false) {
    return this.repo.find({ where: includeInactive ? {} : { isActive: true }, order: { name: 'ASC' } });
  }

  async create(dto: CreateDepartmentDto, actorId: string, ip: string | null) {
    await this.ensureUnique(dto.name);
    const saved = await this.repo.save(this.repo.create(dto));
    await this.audit.log({ userId: actorId, action: AuditAction.CREATE, entity: 'department', entityId: saved.id, summary: `Departamento criado: ${saved.name}`, ip });
    return saved;
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId: string, ip: string | null) {
    const dep = await this.repo.findOne({ where: { id } });
    if (!dep) throw new NotFoundException('Departamento não encontrado');
    if (dto.name && dto.name.toLowerCase() !== dep.name.toLowerCase()) await this.ensureUnique(dto.name);
    Object.assign(dep, dto);
    const saved = await this.repo.save(dep);
    await this.audit.log({ userId: actorId, action: AuditAction.UPDATE, entity: 'department', entityId: id, summary: `Departamento actualizado: ${saved.name}`, changes: { ...dto }, ip });
    return saved;
  }

  async remove(id: string, actorId: string, ip: string | null) {
    const dep = await this.repo.findOne({ where: { id } });
    if (!dep) throw new NotFoundException('Departamento não encontrado');
    if (await this.collaborators.exists({ where: { departmentId: id } })) {
      throw new ConflictException('O departamento tem colaboradores associados — desactive-o em vez de o eliminar');
    }
    await this.repo.delete(id);
    await this.audit.log({ userId: actorId, action: AuditAction.DELETE, entity: 'department', entityId: id, summary: `Departamento eliminado: ${dep.name}`, ip });
    return { ok: true };
  }

  private async ensureUnique(name: string) {
    const exists = await this.repo.createQueryBuilder('d').where('LOWER(d.name) = LOWER(:name)', { name }).getExists();
    if (exists) throw new ConflictException('Já existe um departamento com este nome');
  }
}

@ApiTags('Departamentos')
@ApiBearerAuth('JWT')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.create(dto, u.id, clientIp(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.update(id, dto, u.id, clientIp(req));
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: User, @Req() req: Request) {
    return this.service.remove(id, u.id, clientIp(req));
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Department, Collaborator])],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
})
export class DepartmentsModule {}
