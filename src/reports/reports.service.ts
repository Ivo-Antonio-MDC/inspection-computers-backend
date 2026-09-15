import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums';
import { Inspection } from '../inspections/entities/inspection.entity';
import { EquipmentQueryDto } from '../records/dto/record.dto';
import { Equipment } from '../records/entities/equipment.entity';
import { EquipmentService, SERIAL_REQUIRED_TYPES } from '../records/equipment.service';
import {
  BATTERY_LABELS,
  CONDITION_LABELS,
  EQUIPMENT_TYPE_LABELS,
  ESET_LABELS,
  MODALITY_LABELS,
  PROBLEM_LABELS,
  RECORD_STATUS_LABELS,
  STORAGE_LABELS,
  UPDATES_LABELS,
} from '../records/labels';
import { pad } from '../records/records.service';

type Row = Record<string, unknown>;

const SERIAL_REQUIRED_SQL = SERIAL_REQUIRED_TYPES.map((t) => `'${t}'`).join(',');

@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Inspection) private readonly inspections: Repository<Inspection>,
    private readonly equipment: EquipmentService,
    private readonly audit: AuditService,
  ) {}

  /** Indicadores do TR §16 para uma inspecção. */
  async summary(inspectionId: string) {
    const inspection = await this.inspections.findOne({ where: { id: inspectionId } });
    if (!inspection) throw new NotFoundException('Inspecção não encontrada');
    const p = [inspectionId];

    const [
      [equipmentTotals],
      [collaboratorTotals],
      recordsByStatus,
      byLocation,
      byDepartment,
      byType,
      byCondition,
      byProblem,
      eset,
      updates,
      byTechnician,
      byCollaborator,
      timeline,
      recent,
    ] = await Promise.all([
      this.ds.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE has_problems)::int AS "withProblems",
                COUNT(*) FILTER (WHERE serial_unavailable OR (serial_number IS NULL AND type IN (${SERIAL_REQUIRED_SQL})))::int AS "missingSerial",
                COUNT(*) FILTER (WHERE NOT is_complete)::int AS incomplete,
                COUNT(*) FILTER (WHERE needs_maintenance)::int AS "needsMaintenance",
                COUNT(*) FILTER (WHERE needs_replacement)::int AS "needsReplacement",
                COUNT(*) FILTER (WHERE type IN ('laptop','desktop'))::int AS computers
           FROM equipment WHERE inspection_id = $1`,
        p,
      ),
      this.ds.query(
        `SELECT (SELECT COUNT(*) FROM collaborators)::int AS total,
                COUNT(r.id)::int AS "withRecord",
                COUNT(r.id) FILTER (WHERE r.status IN ('submetido','validado'))::int AS completed
           FROM inspection_records r WHERE r.inspection_id = $1`,
        p,
      ),
      this.ds.query(
        `SELECT status, COUNT(*)::int AS total FROM inspection_records
          WHERE inspection_id = $1 GROUP BY status`,
        p,
      ),
      this.ds.query(
        `SELECT l.id, l.name, l.modality,
                COUNT(DISTINCT c.id)::int AS collaborators,
                COUNT(DISTINCT r.id)::int AS records,
                COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('submetido','validado'))::int AS completed,
                COUNT(e.id)::int AS equipment,
                COUNT(e.id) FILTER (WHERE e.has_problems)::int AS "withProblems"
           FROM locations l
           LEFT JOIN collaborators c ON c.location_id = l.id
           LEFT JOIN inspection_records r ON r.collaborator_id = c.id AND r.inspection_id = $1
           LEFT JOIN equipment e ON e.record_id = r.id
          GROUP BY l.id ORDER BY l.modality, l.name`,
        p,
      ),
      this.ds.query(
        `SELECT d.id, d.name,
                COUNT(DISTINCT c.id)::int AS collaborators,
                COUNT(DISTINCT r.id)::int AS records,
                COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('submetido','validado'))::int AS completed,
                COUNT(e.id)::int AS equipment,
                COUNT(e.id) FILTER (WHERE e.has_problems)::int AS "withProblems"
           FROM departments d
           LEFT JOIN collaborators c ON c.department_id = d.id
           LEFT JOIN inspection_records r ON r.collaborator_id = c.id AND r.inspection_id = $1
           LEFT JOIN equipment e ON e.record_id = r.id
          GROUP BY d.id ORDER BY d.name`,
        p,
      ),
      this.ds.query(
        `SELECT type, COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE condition = 'bom')::int AS bom,
                COUNT(*) FILTER (WHERE condition = 'razoavel')::int AS razoavel,
                COUNT(*) FILTER (WHERE condition = 'mau')::int AS mau,
                COUNT(*) FILTER (WHERE condition = 'nao_funciona')::int AS nao_funciona,
                COUNT(*) FILTER (WHERE has_problems)::int AS "withProblems",
                COUNT(*) FILTER (WHERE needs_maintenance)::int AS "needsMaintenance",
                COUNT(*) FILTER (WHERE needs_replacement)::int AS "needsReplacement"
           FROM equipment WHERE inspection_id = $1
          GROUP BY type`,
        p,
      ),
      this.ds.query(
        `SELECT COALESCE(condition::text, 'sem_estado') AS condition, COUNT(*)::int AS total
           FROM equipment WHERE inspection_id = $1 GROUP BY 1`,
        p,
      ),
      this.ds.query(
        `SELECT pr::text AS problem, COUNT(*)::int AS total
           FROM equipment e, unnest(e.problems) AS pr
          WHERE e.inspection_id = $1 GROUP BY pr ORDER BY total DESC`,
        p,
      ),
      this.ds.query(
        `SELECT COALESCE(eset_status::text, 'sem_registo') AS status, COUNT(*)::int AS total
           FROM equipment WHERE inspection_id = $1 AND type IN ('laptop','desktop') GROUP BY 1`,
        p,
      ),
      this.ds.query(
        `SELECT COALESCE(updates_status::text, 'sem_registo') AS status, COUNT(*)::int AS total
           FROM equipment WHERE inspection_id = $1 AND type IN ('laptop','desktop') GROUP BY 1`,
        p,
      ),
      this.ds.query(
        `SELECT u.id, u.name, COUNT(r.id)::int AS records
           FROM users u
           LEFT JOIN inspection_records r ON r.created_by_id = u.id AND r.inspection_id = $1
          GROUP BY u.id ORDER BY records DESC, u.name`,
        p,
      ),
      this.ds.query(
        `SELECT c.id, c.name, c.position, d.name AS department, l.name AS location,
                r.id AS "recordId", r.number, r.status,
                COUNT(e.id)::int AS equipment,
                COUNT(e.id) FILTER (WHERE e.has_problems)::int AS "withProblems",
                COALESCE(array_agg(DISTINCT e.type::text) FILTER (WHERE e.id IS NOT NULL), '{}') AS types
           FROM inspection_records r
           JOIN collaborators c ON c.id = r.collaborator_id
           JOIN departments d ON d.id = c.department_id
           JOIN locations l ON l.id = c.location_id
           LEFT JOIN equipment e ON e.record_id = r.id
          WHERE r.inspection_id = $1
          GROUP BY c.id, d.name, l.name, r.id ORDER BY c.name`,
        p,
      ),
      this.ds.query(
        `SELECT to_char(date_trunc('day', submitted_at AT TIME ZONE 'Africa/Maputo'), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS total
           FROM inspection_records
          WHERE inspection_id = $1 AND submitted_at IS NOT NULL
          GROUP BY 1 ORDER BY 1`,
        p,
      ),
      this.ds.query(
        `SELECT r.id, r.number, r.status, r.updated_at AS "updatedAt", c.name AS collaborator,
                l.name AS location, u.name AS technician,
                (SELECT COUNT(*)::int FROM equipment e WHERE e.record_id = r.id) AS equipment
           FROM inspection_records r
           JOIN collaborators c ON c.id = r.collaborator_id
           JOIN locations l ON l.id = c.location_id
           LEFT JOIN users u ON u.id = r.created_by_id
          WHERE r.inspection_id = $1
          ORDER BY r.updated_at DESC LIMIT 8`,
        p,
      ),
    ]);

    return {
      inspection,
      collaborators: collaboratorTotals,
      equipment: equipmentTotals,
      recordsByStatus,
      byLocation,
      byDepartment,
      byType,
      byCondition,
      byProblem,
      software: { eset, updates },
      byTechnician,
      byCollaborator,
      timeline,
      recent,
    };
  }

  // ── Exportação (TR §16) ────────────────────────────────────────────────────

  async exportFile(
    q: EquipmentQueryDto & { inspectionId: string },
    format: 'xlsx' | 'csv',
    actor: { id: string },
    ip: string | null,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const inspection = await this.inspections.findOne({ where: { id: q.inspectionId } });
    if (!inspection) throw new NotFoundException('Inspecção não encontrada');

    const rows = (
      await this.equipment
        .buildQuery(q)
        .addSelect(['e.serialNormalized'])
        .orderBy('l.name', 'ASC')
        .addOrderBy('c.name', 'ASC')
        .addOrderBy('e.position', 'ASC')
        .getMany()
    ).map(equipmentRow);

    const stamp = new Date().toISOString().slice(0, 10);
    const base = `inspeccao-computadores_${slug(inspection.name)}_${stamp}`;

    await this.audit.log({
      userId: actor.id,
      action: AuditAction.EXPORT,
      entity: 'inspection',
      entityId: inspection.id,
      summary: `Exportação ${format.toUpperCase()} — ${rows.length} equipamentos`,
      changes: { filtros: stripPaging({ ...q }) },
      ip,
    });

    if (format === 'csv') {
      return {
        buffer: Buffer.from('﻿' + toCsv(rows), 'utf8'),
        filename: `${base}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    const summary = await this.summary(inspection.id);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'MD Consultores — Departamento de Tecnologia de Informática';
    wb.created = new Date();

    this.addSummarySheet(wb, inspection, summary, rows.length !== summary.equipment.total);
    addTableSheet(wb, 'Equipamentos', rows);
    addTableSheet(
      wb,
      'Por localização',
      summary.byLocation.map((r: Row) => ({
        Localização: r.name,
        Modalidade: MODALITY_LABELS[r.modality as keyof typeof MODALITY_LABELS],
        Colaboradores: r.collaborators,
        'Formulários': r.records,
        'Formulários concluídos': r.completed,
        Equipamentos: r.equipment,
        'Com problemas': r.withProblems,
      })),
    );
    addTableSheet(
      wb,
      'Por departamento',
      summary.byDepartment.map((r: Row) => ({
        Departamento: r.name,
        Colaboradores: r.collaborators,
        'Formulários': r.records,
        'Formulários concluídos': r.completed,
        Equipamentos: r.equipment,
        'Com problemas': r.withProblems,
      })),
    );
    addTableSheet(
      wb,
      'Por tipo e estado',
      summary.byType.map((r: Row) => ({
        Tipo: EQUIPMENT_TYPE_LABELS[r.type as keyof typeof EQUIPMENT_TYPE_LABELS],
        Total: r.total,
        Bom: r.bom,
        Razoável: r.razoavel,
        Mau: r.mau,
        'Não funciona': r.nao_funciona,
        'Com problemas': r.withProblems,
        'Necessita manutenção': r.needsMaintenance,
        'Necessita substituição': r.needsReplacement,
      })),
    );
    addTableSheet(
      wb,
      'Por utilizador',
      summary.byCollaborator.map((r: Row) => ({
        'Nº formulário': `INS-${pad(r.number as number)}`,
        Colaborador: r.name,
        'Cargo/Função': r.position,
        Departamento: r.department,
        Localização: r.location,
        'Estado do formulário': RECORD_STATUS_LABELS[r.status as keyof typeof RECORD_STATUS_LABELS],
        Equipamentos: r.equipment,
        'Com problemas': r.withProblems,
        Tipos: (r.types as string[]).map((t) => EQUIPMENT_TYPE_LABELS[t as keyof typeof EQUIPMENT_TYPE_LABELS]).join(', '),
      })),
    );
    addTableSheet(
      wb,
      'Problemas',
      summary.byProblem.map((r: Row) => ({
        Problema: PROBLEM_LABELS[r.problem as keyof typeof PROBLEM_LABELS] ?? r.problem,
        Ocorrências: r.total,
      })),
    );

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return {
      buffer,
      filename: `${base}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private addSummarySheet(
    wb: ExcelJS.Workbook,
    inspection: Inspection,
    s: Awaited<ReturnType<ReportsService['summary']>>,
    filtered: boolean,
  ) {
    const ws = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 46 }, { width: 18 }];

    ws.addRow(['MD Consultores — Inspecção Geral do Parque Informático']).font = { bold: true, size: 14 };
    ws.addRow([inspection.name]).font = { size: 12, color: { argb: 'FF465FFF' } };
    ws.addRow([`Gerado em ${new Date().toLocaleString('pt-PT', { timeZone: 'Africa/Maputo' })}`]).font = {
      color: { argb: 'FF667085' },
    };
    if (filtered) {
      ws.addRow(['Nota: a folha "Equipamentos" foi exportada com filtros aplicados.']).font = {
        italic: true,
        color: { argb: 'FFB54708' },
      };
    }
    ws.addRow([]);

    const section = (title: string, entries: [string, unknown][]) => {
      const head = ws.addRow([title, '']);
      head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      head.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF465FFF' } }));
      for (const [label, value] of entries) {
        const r = ws.addRow([label, value]);
        r.getCell(2).alignment = { horizontal: 'right' };
        r.eachCell((c) => (c.border = { bottom: { style: 'thin', color: { argb: 'FFE4E7EC' } } }));
      }
      ws.addRow([]);
    };

    const status = Object.fromEntries(s.recordsByStatus.map((r: Row) => [r.status, r.total]));
    section('Progresso da inspecção', [
      ['Colaboradores registados', s.collaborators.total],
      ['Colaboradores com formulário', s.collaborators.withRecord],
      ['Formulários concluídos (submetidos + validados)', s.collaborators.completed],
      ['Rascunhos', status.rascunho ?? 0],
      ['Submetidos (a aguardar validação)', status.submetido ?? 0],
      ['Validados', status.validado ?? 0],
      ['A requerer correcção', status.requer_correccao ?? 0],
    ]);
    section('Indicadores de equipamentos', [
      ['Total de equipamentos inspeccionados', s.equipment.total],
      ['Computadores (laptop + desktop)', s.equipment.computers],
      ['Equipamentos com problemas', s.equipment.withProblems],
      ['Equipamentos sem número de série', s.equipment.missingSerial],
      ['Equipamentos com dados incompletos', s.equipment.incomplete],
      ['Necessidades de manutenção', s.equipment.needsMaintenance],
      ['Necessidades de substituição', s.equipment.needsReplacement],
    ]);
    section(
      'Equipamentos por estado',
      s.byCondition.map((r: Row) => [
        CONDITION_LABELS[r.condition as keyof typeof CONDITION_LABELS] ?? 'Sem estado registado',
        r.total,
      ]),
    );
    section(
      'Antivírus ESET (computadores)',
      s.software.eset.map((r: Row) => [ESET_LABELS[r.status as keyof typeof ESET_LABELS] ?? 'Sem registo', r.total]),
    );
    section(
      'Actualizações do sistema (computadores)',
      s.software.updates.map((r: Row) => [
        UPDATES_LABELS[r.status as keyof typeof UPDATES_LABELS] ?? 'Sem registo',
        r.total,
      ]),
    );
  }
}

// ── Helpers de exportação ────────────────────────────────────────────────────

const yesNo = (v: boolean) => (v ? 'Sim' : 'Não');

function equipmentRow(e: Equipment): Row {
  const r = e.record;
  const c = r.collaborator;
  return {
    'Nº formulário': `INS-${pad(r.number)}`,
    'Estado do formulário': RECORD_STATUS_LABELS[r.status],
    Colaborador: c.name,
    'Cargo/Função': c.position,
    Departamento: c.department.name,
    Localização: c.location.name,
    Modalidade: MODALITY_LABELS[c.location.modality],
    Tipo: EQUIPMENT_TYPE_LABELS[e.type],
    'Tipo/descrição (outro)': e.otherDescription ?? '',
    Marca: e.brand ?? '',
    Modelo: e.model ?? '',
    'Número de série': e.serialNumber ?? '',
    'Sem nº de série': yesNo(e.serialUnavailable),
    'ID do activo': e.assetTag ?? '',
    Processador: e.processor ?? '',
    'RAM (GB)': e.ramGb ?? '',
    'Tipo de armazenamento': e.storageType ? STORAGE_LABELS[e.storageType] : '',
    'Capacidade (GB)': e.storageCapacityGb ?? '',
    'Sistema operativo': e.operatingSystem ?? '',
    Hostname: e.hostname ?? '',
    'Endereço IP': e.ipAddress ?? '',
    'Tamanho (pol.)': e.screenSizeInches ?? '',
    'Estado físico': e.condition ? CONDITION_LABELS[e.condition] : '',
    'Descrição do estado': e.conditionNotes ?? '',
    'Estado da bateria': e.batteryStatus ? BATTERY_LABELS[e.batteryStatus] : '',
    'Problemas identificados': (e.problems ?? []).map((p) => PROBLEM_LABELS[p]).join('; '),
    'Descrição dos problemas': e.problemDescription ?? '',
    Observações: e.observations ?? '',
    'Estado das actualizações': e.updatesStatus ? UPDATES_LABELS[e.updatesStatus] : '',
    'Estado do ESET': e.esetStatus ? ESET_LABELS[e.esetStatus] : '',
    'Problemas com aplicações': e.appIssues ?? '',
    'Observações de software': e.softwareNotes ?? '',
    'Software verificado pela TI': e.type === 'laptop' || e.type === 'desktop' ? yesNo(e.softwareVerified) : '',
    'Com problemas': yesNo(e.hasProblems),
    'Necessita manutenção': yesNo(e.needsMaintenance),
    'Necessita substituição': yesNo(e.needsReplacement),
    'Dados completos': yesNo(e.isComplete),
    'Registado por': r.createdBy?.name ?? '',
    'Actualizado em': r.updatedAt,
  };
}

function addTableSheet(wb: ExcelJS.Workbook, name: string, rows: Row[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = rows.length ? Object.keys(rows[0]) : ['Sem dados'];
  ws.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.min(
      48,
      Math.max(h.length + 2, ...rows.slice(0, 200).map((r) => String(r[h] ?? '').length + 2), 10),
    ),
  }));
  for (const r of rows) ws.addRow(r);

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  header.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF465FFF' } }));
  if (rows.length) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  }
  if (headers.includes('Actualizado em')) ws.getColumn('Actualizado em').numFmt = 'dd/mm/yyyy hh:mm';
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return 'Sem dados\r\n';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : String(v ?? '');
    // Evita injecção de fórmulas ao abrir no Excel
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  // Separador ";" — o Excel em português usa a vírgula como separador decimal
  return [headers.map(esc).join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\r\n');
}

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function stripPaging(q: Row) {
  const { page: _p, limit: _l, ...rest } = q;
  return rest;
}
