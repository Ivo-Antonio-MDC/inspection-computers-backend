import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction } from '../common/enums';
import { paginated } from '../common/dto/pagination.dto';
import { AuditLog } from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  changes?: Record<string, unknown> | null;
  ip?: string | null;
}

const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'currentPassword', 'newPassword', 'token']);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /** Nunca deve fazer falhar a operação principal. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          userId: entry.userId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          summary: entry.summary?.slice(0, 255) ?? null,
          changes: entry.changes ? redact(entry.changes) : null,
          ip: entry.ip ?? null,
        }),
      );
    } catch (err) {
      this.logger.error(`Falha ao gravar auditoria: ${(err as Error).message}`);
    }
  }

  async list(q: AuditQueryDto) {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoin('a.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email'])
      .orderBy('a.createdAt', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);

    if (q.entity) qb.andWhere('a.entity = :entity', { entity: q.entity });
    if (q.entityId) qb.andWhere('a.entityId = :entityId', { entityId: q.entityId });
    if (q.action) qb.andWhere('a.action = :action', { action: q.action });
    if (q.userId) qb.andWhere('a.userId = :userId', { userId: q.userId });

    const [items, total] = await qb.getManyAndCount();
    return paginated(items, total, q.page, q.limit);
  }
}

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !SENSITIVE_KEYS.has(k))
      .map(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
          ? [k, redact(v as Record<string, unknown>)]
          : [k, v],
      ),
  );
}

/** Calcula as diferenças entre dois objectos planos (apenas chaves alteradas). */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
): Record<string, { de: unknown; para: unknown }> {
  const out: Record<string, { de: unknown; para: unknown }> = {};
  for (const k of keys) {
    const a = before[k] ?? null;
    const b = after[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { de: a, para: b };
  }
  return out;
}
