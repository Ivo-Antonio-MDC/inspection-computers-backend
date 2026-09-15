import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService, diff } from '../audit/audit.service';
import { paginated } from '../common/dto/pagination.dto';
import { AuditAction } from '../common/enums';
import { likePattern, normalizeText } from '../common/utils/text';
import { Department } from '../departments/entities/department.entity';
import { Location } from '../locations/entities/location.entity';
import { InspectionRecord } from '../records/entities/inspection-record.entity';
import {
  CollaboratorQueryDto,
  CreateCollaboratorDto,
  UpdateCollaboratorDto,
} from './dto/collaborator.dto';
import { Collaborator } from './entities/collaborator.entity';

@Injectable()
export class CollaboratorsService {
  constructor(
    @InjectRepository(Collaborator) private readonly repo: Repository<Collaborator>,
    @InjectRepository(Department) private readonly departments: Repository<Department>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(InspectionRecord) private readonly records: Repository<InspectionRecord>,
    private readonly audit: AuditService,
  ) {}

  async findAll(q: CollaboratorQueryDto) {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.department', 'd')
      .leftJoinAndSelect('c.location', 'l')
      .orderBy('c.name', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.search) {
      qb.andWhere('(c.nameNormalized ILIKE :s OR c.position ILIKE :raw)', {
        s: likePattern(normalizeText(q.search)),
        raw: likePattern(q.search),
      });
    }
    if (q.departmentId) qb.andWhere('c.departmentId = :dep', { dep: q.departmentId });
    if (q.locationId) qb.andWhere('c.locationId = :loc', { loc: q.locationId });

    if (q.inspectionId) {
      qb.leftJoin('c.records', 'r', 'r.inspectionId = :insp', { insp: q.inspectionId })
        .addSelect(['r.id', 'r.number', 'r.status', 'r.updatedAt', 'r.incompleteCount']);
      if (q.recordStatus === 'sem_registo') qb.andWhere('r.id IS NULL');
      else if (q.recordStatus) qb.andWhere('r.status = :rs', { rs: q.recordStatus });
    }

    const [items, total] = await qb.getManyAndCount();
    const data = items.map(({ records, ...c }) => ({
      ...c,
      record: q.inspectionId ? (records?.[0] ?? null) : undefined,
    }));
    return paginated(data, total, q.page, q.limit);
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id }, relations: { department: true, location: true } });
    if (!c) throw new NotFoundException('Colaborador não encontrado');
    const history = await this.records.find({
      where: { collaboratorId: id },
      relations: { inspection: true },
      order: { createdAt: 'DESC' },
    });
    return { ...c, records: history };
  }

  async create(dto: CreateCollaboratorDto, actorId: string, ip: string | null) {
    await this.checkReferences(dto.departmentId, dto.locationId);
    const nameNormalized = normalizeText(dto.name);
    await this.ensureNotDuplicate(nameNormalized, dto.locationId);

    const saved = await this.repo.save(this.repo.create({ ...dto, nameNormalized }));
    await this.audit.log({
      userId: actorId,
      action: AuditAction.CREATE,
      entity: 'collaborator',
      entityId: saved.id,
      summary: `Colaborador registado: ${saved.name}`,
      ip,
    });
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateCollaboratorDto, actorId: string, ip: string | null) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Colaborador não encontrado');
    const before = { ...c };

    if (dto.departmentId || dto.locationId) {
      await this.checkReferences(dto.departmentId ?? c.departmentId, dto.locationId ?? c.locationId);
    }
    const name = dto.name ?? c.name;
    const locationId = dto.locationId ?? c.locationId;
    const nameNormalized = normalizeText(name);
    await this.ensureNotDuplicate(nameNormalized, locationId, id);

    Object.assign(c, dto, { nameNormalized });
    await this.repo.save(c);
    await this.audit.log({
      userId: actorId,
      action: AuditAction.UPDATE,
      entity: 'collaborator',
      entityId: id,
      summary: `Colaborador actualizado: ${c.name}`,
      changes: diff(before, c as unknown as Record<string, unknown>, ['name', 'departmentId', 'locationId', 'position']),
      ip,
    });
    return this.findOne(id);
  }

  async remove(id: string, actorId: string, ip: string | null) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Colaborador não encontrado');
    if (await this.records.exists({ where: { collaboratorId: id } })) {
      throw new ConflictException('O colaborador tem formulários de inspecção — elimine-os primeiro');
    }
    await this.repo.delete(id);
    await this.audit.log({
      userId: actorId,
      action: AuditAction.DELETE,
      entity: 'collaborator',
      entityId: id,
      summary: `Colaborador eliminado: ${c.name}`,
      ip,
    });
    return { ok: true };
  }

  private async checkReferences(departmentId: string, locationId: string) {
    if (!(await this.departments.exists({ where: { id: departmentId } }))) {
      throw new NotFoundException('Departamento não encontrado');
    }
    if (!(await this.locations.exists({ where: { id: locationId } }))) {
      throw new NotFoundException('Localização não encontrada');
    }
  }

  private async ensureNotDuplicate(nameNormalized: string, locationId: string, exceptId?: string) {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.nameNormalized = :n', { n: nameNormalized })
      .andWhere('c.locationId = :l', { l: locationId });
    if (exceptId) qb.andWhere('c.id <> :id', { id: exceptId });
    if (await qb.getExists()) {
      throw new ConflictException('Já existe um colaborador com este nome nesta localização');
    }
  }
}
