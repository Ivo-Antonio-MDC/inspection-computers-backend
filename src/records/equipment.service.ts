import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { paginated } from '../common/dto/pagination.dto';
import { likePattern, normalizeSerial, normalizeText } from '../common/utils/text';
import { EquipmentQueryDto } from './dto/record.dto';
import { Equipment } from './entities/equipment.entity';

/** Tipos para os quais o nº de série é obrigatório (TR §8.1–8.3). */
export const SERIAL_REQUIRED_TYPES = ['laptop', 'desktop', 'monitor'];

@Injectable()
export class EquipmentService {
  constructor(@InjectRepository(Equipment) private readonly repo: Repository<Equipment>) {}

  /** Query base partilhada pela listagem e pela exportação. */
  buildQuery(q: Omit<EquipmentQueryDto, 'page' | 'limit'>): SelectQueryBuilder<Equipment> {
    const qb = this.repo
      .createQueryBuilder('e')
      .innerJoin('e.record', 'r')
      .addSelect(['r.id', 'r.number', 'r.status', 'r.inspectionId', 'r.updatedAt'])
      .innerJoin('r.collaborator', 'c')
      .addSelect(['c.id', 'c.name', 'c.position'])
      .innerJoinAndSelect('c.department', 'd')
      .innerJoinAndSelect('c.location', 'l')
      .leftJoin('r.createdBy', 'u')
      .addSelect(['u.id', 'u.name']);

    if (q.inspectionId) qb.andWhere('e.inspectionId = :insp', { insp: q.inspectionId });
    if (q.type) qb.andWhere('e.type = :type', { type: q.type });
    if (q.condition) qb.andWhere('e.condition = :cond', { cond: q.condition });
    if (q.recordStatus) qb.andWhere('r.status = :rs', { rs: q.recordStatus });
    if (q.locationId) qb.andWhere('c.locationId = :loc', { loc: q.locationId });
    if (q.departmentId) qb.andWhere('c.departmentId = :dep', { dep: q.departmentId });
    if (q.collaboratorId) qb.andWhere('r.collaboratorId = :col', { col: q.collaboratorId });
    if (q.problem) qb.andWhere(':problem = ANY(e.problems)', { problem: q.problem });
    if (q.hasProblems !== undefined) qb.andWhere('e.hasProblems = :hp', { hp: q.hasProblems });
    if (q.incomplete !== undefined) qb.andWhere('e.isComplete = :ic', { ic: !q.incomplete });
    if (q.needsMaintenance !== undefined) qb.andWhere('e.needsMaintenance = :nm', { nm: q.needsMaintenance });
    if (q.needsReplacement !== undefined) qb.andWhere('e.needsReplacement = :nr', { nr: q.needsReplacement });
    if (q.missingSerial !== undefined) {
      const missing = `(e.serialUnavailable = true OR (e.serialNumber IS NULL AND e.type IN (:...srt)))`;
      qb.andWhere(q.missingSerial ? missing : `NOT ${missing}`, { srt: SERIAL_REQUIRED_TYPES });
    }
    if (q.search) {
      const term = q.search.trim();
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('e.serialNormalized ILIKE :serial')
            .orWhere('e.brand ILIKE :raw')
            .orWhere('e.model ILIKE :raw')
            .orWhere('e.hostname ILIKE :raw')
            .orWhere('e.assetTag ILIKE :raw')
            .orWhere('e.otherDescription ILIKE :raw')
            .orWhere('c.nameNormalized ILIKE :name'),
        ),
      ).setParameters({
        serial: likePattern(normalizeSerial(term) ?? term),
        raw: likePattern(term),
        name: likePattern(normalizeText(term)),
      });
    }
    return qb;
  }

  async findAll(q: EquipmentQueryDto) {
    const [items, total] = await this.buildQuery(q)
      .orderBy('l.name', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .addOrderBy('e.position', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();
    return paginated(items, total, q.page, q.limit);
  }
}
