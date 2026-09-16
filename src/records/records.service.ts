import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { paginated } from '../common/dto/pagination.dto';
import { AuditAction, InspectionStatus, RecordStatus, UserRole } from '../common/enums';
import { clean, likePattern, normalizeSerial, normalizeText } from '../common/utils/text';
import { Inspection } from '../inspections/entities/inspection.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateRecordDto,
  EquipmentDto,
  RecordQueryDto,
  ReviewRecordDto,
  UpdateRecordDto,
  ValidateRecordDto,
} from './dto/record.dto';
import { Equipment } from './entities/equipment.entity';
import { InspectionRecord } from './entities/inspection-record.entity';
import {
  computeHasProblems,
  EQUIPMENT_RULES,
  EquipmentField,
  EquipmentInput,
  RecordValidation,
  validateRecord,
  ValidationMode,
} from './equipment-rules';
import { EQUIPMENT_TYPE_LABELS } from './labels';

const STRING_FIELDS: EquipmentField[] = [
  'otherDescription', 'brand', 'model', 'serialNumber', 'assetTag', 'processor',
  'operatingSystem', 'hostname', 'ipAddress', 'conditionNotes', 'problemDescription',
  'observations', 'appIssues', 'softwareNotes',
];
const NUMBER_FIELDS: EquipmentField[] = ['ramGb', 'storageCapacityGb', 'screenSizeInches'];
const BOOLEAN_FIELDS: EquipmentField[] = [
  'serialUnavailable', 'softwareVerified', 'needsMaintenance', 'needsReplacement',
];
const ENUM_FIELDS: EquipmentField[] = [
  'storageType', 'condition', 'batteryStatus', 'updatesStatus', 'esetStatus',
];

type SanitizedEquipment = EquipmentInput & { id?: string };

interface Meta {
  user: User;
  ip: string | null;
}

@Injectable()
export class RecordsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(InspectionRecord) private readonly records: Repository<InspectionRecord>,
    @InjectRepository(Equipment) private readonly equipment: Repository<Equipment>,
    @InjectRepository(Inspection) private readonly inspections: Repository<Inspection>,
    @InjectRepository(Collaborator) private readonly collaborators: Repository<Collaborator>,
    private readonly audit: AuditService,
  ) {}

  // ── Consulta ───────────────────────────────────────────────────────────────

  async findAll(q: RecordQueryDto) {
    const qb = this.records
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.collaborator', 'c')
      .innerJoinAndSelect('c.department', 'd')
      .innerJoinAndSelect('c.location', 'l')
      .leftJoin('r.createdBy', 'u')
      .addSelect(['u.id', 'u.name'])
      .leftJoin('r.equipment', 'e')
      .addSelect(['e.id', 'e.type', 'e.position', 'e.otherDescription', 'e.brand', 'e.model', 'e.condition', 'e.hasProblems', 'e.isComplete'])
      .orderBy('r.updatedAt', 'DESC')
      .addOrderBy('e.position', 'ASC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.inspectionId) qb.andWhere('r.inspectionId = :insp', { insp: q.inspectionId });
    if (q.status) qb.andWhere('r.status = :status', { status: q.status });
    if (q.locationId) qb.andWhere('c.locationId = :loc', { loc: q.locationId });
    if (q.departmentId) qb.andWhere('c.departmentId = :dep', { dep: q.departmentId });
    if (q.createdById) qb.andWhere('r.createdById = :tech', { tech: q.createdById });
    if (q.incomplete !== undefined) qb.andWhere(q.incomplete ? 'r.incompleteCount > 0' : 'r.incompleteCount = 0');
    if (q.hasProblems !== undefined) {
      qb.andWhere(
        `${q.hasProblems ? '' : 'NOT '}EXISTS (SELECT 1 FROM equipment ep WHERE ep.record_id = r.id AND ep.has_problems)`,
      );
    }
    if (q.equipmentType) {
      qb.andWhere('EXISTS (SELECT 1 FROM equipment et WHERE et.record_id = r.id AND et.type = :etype)', {
        etype: q.equipmentType,
      });
    }
    if (q.search) this.applyRecordSearch(qb, q.search);

    const [items, total] = await qb.getManyAndCount();
    return paginated(items, total, q.page, q.limit);
  }

  async findOne(id: string) {
    const record = await this.records.findOne({
      where: { id },
      relations: {
        collaborator: { department: true, location: true },
        inspection: true,
        createdBy: true,
        updatedBy: true,
        validatedBy: true,
        equipment: true,
      },
      order: { equipment: { position: 'ASC' } },
    });
    if (!record) throw new NotFoundException('Formulário não encontrado');
    return record;
  }

  /** Usado no passo de identificação para evitar formulários duplicados. */
  async findByCollaborator(inspectionId: string, collaboratorId: string) {
    return this.records.findOne({
      where: { inspectionId, collaboratorId },
      select: { id: true, number: true, status: true },
    });
  }

  // ── Validação (TR §12) ─────────────────────────────────────────────────────

  /** Validação sem gravar — alimenta o passo "Validação" do formulário. */
  async dryRun(dto: ValidateRecordDto): Promise<RecordValidation & { missingCount: number }> {
    const items = dto.equipment.map((e) => this.sanitize(e));
    const result = validateRecord(items, 'submit');
    await this.checkSerialDuplicatesInDb(dto.inspectionId, items, result, dto.recordId);
    result.valid = result.formErrors.length === 0 && result.items.every((i) => Object.keys(i.errors).length === 0);
    return { ...result, missingCount: result.items.filter((i) => i.missing.length > 0).length };
  }

  // ── Criação / edição ───────────────────────────────────────────────────────

  async create(dto: CreateRecordDto, meta: Meta) {
    const inspection = await this.inspections.findOne({ where: { id: dto.inspectionId } });
    if (!inspection) throw new NotFoundException('Inspecção não encontrada');
    this.assertInspectionWritable(inspection, meta.user);

    const collaborator = await this.collaborators.findOne({ where: { id: dto.collaboratorId } });
    if (!collaborator) throw new NotFoundException('Colaborador não encontrado');

    const existing = await this.findByCollaborator(dto.inspectionId, dto.collaboratorId);
    if (existing) {
      throw new ConflictException({
        message: `${collaborator.name} já tem um formulário nesta inspecção (INS-${pad(existing.number)})`,
        error: 'Conflict',
        details: { recordId: existing.id },
      });
    }

    const items = dto.equipment.map((e) => this.sanitize(e));
    const mode: ValidationMode = dto.submit ? 'submit' : 'draft';
    await this.assertValid(dto.inspectionId, items, mode);

    const recordId = await this.dataSource.transaction(async (m) => {
      const record = await m.save(
        m.create(InspectionRecord, {
          inspectionId: dto.inspectionId,
          collaboratorId: dto.collaboratorId,
          generalNotes: clean(dto.generalNotes),
          status: dto.submit ? RecordStatus.SUBMETIDO : RecordStatus.RASCUNHO,
          submittedAt: dto.submit ? new Date() : null,
          createdById: meta.user.id,
          updatedById: meta.user.id,
        }),
      );
      const incomplete = await this.writeEquipment(m, record, items, []);
      await m.update(InspectionRecord, record.id, { incompleteCount: incomplete });
      return record.id;
    });

    const saved = await this.findOne(recordId);
    await this.audit.log({
      userId: meta.user.id,
      action: dto.submit ? AuditAction.SUBMIT : AuditAction.CREATE,
      entity: 'record',
      entityId: recordId,
      summary: `${dto.submit ? 'Formulário submetido' : 'Rascunho criado'}: INS-${pad(saved.number)} — ${collaborator.name} (${describeItems(items)})`,
      changes: { equipamentos: snapshot(saved.equipment) },
      ip: meta.ip,
    });
    return saved;
  }

  async update(id: string, dto: UpdateRecordDto, meta: Meta) {
    const record = await this.findOne(id);
    this.assertInspectionWritable(record.inspection, meta.user);
    if (record.status === RecordStatus.VALIDADO && meta.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Formulário já validado — apenas o administrador o pode alterar');
    }

    const items = dto.equipment.map((e) => this.sanitize(e));
    const previousStatus = record.status;
    const isDraftLike = [RecordStatus.RASCUNHO, RecordStatus.REQUER_CORRECCAO].includes(previousStatus);
    // Um formulário submetido ou validado não pode voltar a ficar incompleto; editá-lo
    // devolve-o ao estado "submetido" para nova validação.
    const mode: ValidationMode = dto.submit || !isDraftLike ? 'submit' : 'draft';
    const nextStatus = dto.submit || !isDraftLike ? RecordStatus.SUBMETIDO : previousStatus;
    await this.assertValid(record.inspectionId, items, mode, record.id);

    const before = snapshot(record.equipment);

    await this.dataSource.transaction(async (m) => {
      const incomplete = await this.writeEquipment(m, record, items, record.equipment);
      await m.update(InspectionRecord, record.id, {
        generalNotes: clean(dto.generalNotes),
        status: nextStatus,
        submittedAt: nextStatus === RecordStatus.SUBMETIDO ? (record.submittedAt ?? new Date()) : null,
        incompleteCount: incomplete,
        updatedById: meta.user.id,
        // Qualquer alteração a um formulário validado exige nova validação
        validatedAt: null,
        validatedById: null,
        ...(previousStatus === RecordStatus.VALIDADO ? { reviewComment: null } : {}),
      });
    });

    const saved = await this.findOne(id);
    const submittedNow = nextStatus === RecordStatus.SUBMETIDO && previousStatus !== RecordStatus.SUBMETIDO;
    await this.audit.log({
      userId: meta.user.id,
      action: submittedNow ? AuditAction.SUBMIT : AuditAction.UPDATE,
      entity: 'record',
      entityId: id,
      summary: `${submittedNow ? 'Formulário submetido' : 'Formulário actualizado'}: INS-${pad(saved.number)} — ${saved.collaborator.name}`,
      changes: {
        estado: previousStatus !== nextStatus ? { de: previousStatus, para: nextStatus } : undefined,
        observacoesGerais:
          (record.generalNotes ?? null) !== (saved.generalNotes ?? null)
            ? { de: record.generalNotes, para: saved.generalNotes }
            : undefined,
        equipamentos: { antes: before, depois: snapshot(saved.equipment) },
      },
      ip: meta.ip,
    });
    return saved;
  }

  async review(id: string, dto: ReviewRecordDto, meta: Meta) {
    const record = await this.findOne(id);
    const comment = clean(dto.comment);

    if (dto.decision === 'validar') {
      if (record.status !== RecordStatus.SUBMETIDO) {
        throw new BadRequestException('Apenas formulários submetidos podem ser validados');
      }
      if (record.incompleteCount > 0) {
        throw new BadRequestException('O formulário tem campos obrigatórios em falta');
      }
      await this.records.update(id, {
        status: RecordStatus.VALIDADO,
        validatedAt: new Date(),
        validatedById: meta.user.id,
        reviewComment: comment,
      });
    } else {
      if (![RecordStatus.SUBMETIDO, RecordStatus.VALIDADO].includes(record.status)) {
        throw new BadRequestException('Apenas formulários submetidos ou validados podem ser devolvidos');
      }
      if (!comment) throw new BadRequestException('Indique o que deve ser corrigido');
      await this.records.update(id, {
        status: RecordStatus.REQUER_CORRECCAO,
        validatedAt: null,
        validatedById: null,
        reviewComment: comment,
      });
    }

    await this.audit.log({
      userId: meta.user.id,
      action: dto.decision === 'validar' ? AuditAction.VALIDATE : AuditAction.REQUEST_CORRECTION,
      entity: 'record',
      entityId: id,
      summary: `${dto.decision === 'validar' ? 'Formulário validado' : 'Correcção pedida'}: INS-${pad(record.number)} — ${record.collaborator.name}`,
      changes: comment ? { comentario: comment } : null,
      ip: meta.ip,
    });
    return this.findOne(id);
  }

  async remove(id: string, meta: Meta) {
    const record = await this.findOne(id);
    await this.records.delete(id);
    await this.audit.log({
      userId: meta.user.id,
      action: AuditAction.DELETE,
      entity: 'record',
      entityId: id,
      summary: `Formulário eliminado: INS-${pad(record.number)} — ${record.collaborator.name}`,
      changes: { equipamentos: snapshot(record.equipment) },
      ip: meta.ip,
    });
    return { ok: true };
  }

  // ── Internos ───────────────────────────────────────────────────────────────

  /**
   * Mantém apenas os campos aplicáveis ao tipo (TR §8: "os campos não aplicáveis
   * não deverão ser apresentados") e normaliza espaços/valores vazios.
   */
  private sanitize(dto: EquipmentDto): SanitizedEquipment {
    const rules = EQUIPMENT_RULES[dto.type];
    const allowed = new Set<EquipmentField>(rules.fields);
    const src = dto as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = { type: dto.type, id: dto.id };

    for (const f of STRING_FIELDS) out[f] = allowed.has(f) ? clean(src[f] as string) : null;
    for (const f of NUMBER_FIELDS) {
      const v = src[f];
      out[f] = allowed.has(f) && v !== null && v !== undefined && v !== '' ? Number(v) : null;
    }
    for (const f of BOOLEAN_FIELDS) out[f] = allowed.has(f) ? Boolean(src[f]) : false;
    for (const f of ENUM_FIELDS) out[f] = allowed.has(f) ? (src[f] ?? null) : null;
    out.problems = allowed.has('problems') ? [...new Set((src.problems as string[] | null) ?? [])] : [];

    return out as unknown as SanitizedEquipment;
  }

  private async assertValid(
    inspectionId: string,
    items: SanitizedEquipment[],
    mode: ValidationMode,
    exceptRecordId?: string,
  ) {
    const result = validateRecord(items, mode);
    await this.checkSerialDuplicatesInDb(inspectionId, items, result, exceptRecordId);
    const valid = result.formErrors.length === 0 && result.items.every((i) => Object.keys(i.errors).length === 0);
    if (!valid) {
      const first = result.formErrors[0] ?? Object.values(result.items.find((i) => Object.keys(i.errors).length)!.errors)[0];
      throw new BadRequestException({
        message: first ?? 'Existem campos inválidos no formulário',
        error: 'Validation Failed',
        details: result,
      });
    }
  }

  /** Nº de série já registado noutro formulário da mesma inspecção. */
  private async checkSerialDuplicatesInDb(
    inspectionId: string,
    items: SanitizedEquipment[],
    result: RecordValidation,
    exceptRecordId?: string,
  ) {
    const serials = items
      .map((i, idx) => ({ idx, type: i.type, key: i.serialUnavailable ? null : normalizeSerial(i.serialNumber) }))
      .filter((s): s is { idx: number; type: SanitizedEquipment['type']; key: string } => !!s.key);
    if (serials.length === 0) return;

    const qb = this.equipment
      .createQueryBuilder('e')
      .innerJoin('e.record', 'r')
      .innerJoin('r.collaborator', 'c')
      .select('e.type', 'type')
      .addSelect('e.serialNormalized', 'serial')
      .addSelect('r.number', 'number')
      .addSelect('c.name', 'collaborator')
      .where('e.inspectionId = :insp', { insp: inspectionId })
      .andWhere('e.serialNormalized IN (:...keys)', { keys: serials.map((s) => s.key) });
    if (exceptRecordId) qb.andWhere('e.recordId <> :rid', { rid: exceptRecordId });

    const rows = await qb.getRawMany<{ type: string; serial: string; number: number; collaborator: string }>();
    for (const s of serials) {
      const hit = rows.find((r) => r.type === s.type && r.serial === s.key);
      if (hit) {
        result.items[s.idx].errors.serialNumber =
          `Número de série já registado (INS-${pad(hit.number)} — ${hit.collaborator})`;
      }
    }
  }

  private assertInspectionWritable(inspection: Inspection, user: User) {
    if (inspection.status === InspectionStatus.CONCLUIDA && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Esta inspecção está concluída — apenas o administrador pode alterar registos');
    }
  }

  /** Grava a lista de equipamentos (actualiza, cria e remove). Devolve nº de incompletos. */
  private async writeEquipment(
    m: EntityManager,
    record: InspectionRecord,
    items: SanitizedEquipment[],
    current: Equipment[],
  ): Promise<number> {
    const currentIds = new Set(current.map((e) => e.id));
    const keepIds = new Set(items.map((i) => i.id).filter((id): id is string => !!id && currentIds.has(id)));
    const toDelete = current.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
    if (toDelete.length) await m.delete(Equipment, { id: In(toDelete) });

    // Liberta temporariamente os nº de série para evitar conflitos ao trocar valores entre itens
    if (keepIds.size) await m.update(Equipment, { id: In([...keepIds]) }, { serialNormalized: null });

    const validation = validateRecord(items, 'draft');
    let incomplete = 0;

    for (const [position, item] of items.entries()) {
      const { id, ...data } = item;
      const isComplete = validation.items[position].missing.length === 0;
      if (!isComplete) incomplete++;

      const values: Partial<Equipment> = {
        ...(data as Partial<Equipment>),
        recordId: record.id,
        inspectionId: record.inspectionId,
        position,
        serialNormalized: item.serialUnavailable ? null : normalizeSerial(item.serialNumber),
        hasProblems: computeHasProblems(item),
        isComplete,
      };

      if (id && keepIds.has(id)) {
        const existing = current.find((e) => e.id === id)!;
        if (existing.type !== item.type) {
          throw new BadRequestException('Não é possível alterar o tipo de um equipamento existente');
        }
        await m.update(Equipment, id, values);
      } else {
        await m.insert(Equipment, values);
      }
    }
    return incomplete;
  }

  private applyRecordSearch(qb: SelectQueryBuilder<InspectionRecord>, search: string) {
    const term = search.trim();
    const number = /^(?:INS-?)?0*(\d{1,9})$/i.exec(term)?.[1];
    qb.andWhere(
      new Brackets((w) => {
        w.where('c.nameNormalized ILIKE :s', { s: likePattern(normalizeText(term)) }).orWhere(
          `EXISTS (SELECT 1 FROM equipment es WHERE es.record_id = r.id AND (
             es.serial_normalized ILIKE :serial OR es.hostname ILIKE :raw OR es.asset_tag ILIKE :raw
           ))`,
          { serial: likePattern(normalizeSerial(term) ?? term), raw: likePattern(term) },
        );
        if (number) w.orWhere('r.number = :num', { num: Number(number) });
      }),
    );
  }
}

export function pad(n: number): string {
  return String(n).padStart(6, '0');
}

function describeItems(items: EquipmentInput[]): string {
  if (items.length === 0) return 'sem equipamentos';
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
  return [...counts.entries()].map(([t, n]) => `${n}× ${EQUIPMENT_TYPE_LABELS[t as keyof typeof EQUIPMENT_TYPE_LABELS]}`).join(', ');
}

function snapshot(items: Equipment[] | undefined) {
  return (items ?? []).map((e) => ({
    tipo: e.type,
    marca: e.brand,
    modelo: e.model,
    serie: e.serialNumber,
    estado: e.condition,
  }));
}
