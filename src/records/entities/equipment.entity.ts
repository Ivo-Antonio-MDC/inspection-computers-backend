import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  BatteryStatus,
  EquipmentCondition,
  EquipmentType,
  EsetStatus,
  ProblemType,
  StorageType,
  UpdatesStatus,
} from '../../common/enums';
import { InspectionRecord } from './inspection-record.entity';

const decimal = {
  to: (v: number | null | undefined) => v,
  from: (v: string | null) => (v === null ? null : Number(v)),
};

/**
 * Equipamento inspeccionado. Cada equipamento é individualizado (TR §13), com os
 * campos aplicáveis ao seu tipo (TR §8) — os restantes ficam a null.
 */
@Entity('equipment')
@Index('uq_equipment_serial_per_inspection', ['inspectionId', 'type', 'serialNormalized'], {
  unique: true,
  where: '"serial_normalized" IS NOT NULL',
})
export class Equipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @ManyToOne(() => InspectionRecord, (r) => r.equipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'record_id' })
  record: InspectionRecord;

  /** Desnormalizado para garantir nº de série único por inspecção */
  @Column({ name: 'inspection_id', type: 'uuid' })
  inspectionId: string;

  @Index()
  @Column({ type: 'enum', enum: EquipmentType, enumName: 'equipment_type' })
  type: EquipmentType;

  /** Ordem de apresentação dentro do formulário */
  @Column({ type: 'smallint', default: 0 })
  position: number;

  // ── Identificação ──────────────────────────────────────────────────────────
  @Column({ name: 'other_description', type: 'varchar', length: 120, nullable: true })
  otherDescription: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ name: 'serial_number', type: 'varchar', length: 80, nullable: true })
  serialNumber: string | null;

  @Column({ name: 'serial_normalized', type: 'varchar', length: 80, nullable: true, select: false })
  serialNormalized: string | null;

  /** Etiqueta ilegível / equipamento sem número de série */
  @Column({ name: 'serial_unavailable', default: false })
  serialUnavailable: boolean;

  @Column({ name: 'asset_tag', type: 'varchar', length: 60, nullable: true })
  assetTag: string | null;

  // ── Especificações (computadores) ──────────────────────────────────────────
  @Column({ type: 'varchar', length: 120, nullable: true })
  processor: string | null;

  @Column({ name: 'ram_gb', type: 'numeric', precision: 6, scale: 1, nullable: true, transformer: decimal })
  ramGb: number | null;

  @Column({ name: 'storage_type', type: 'enum', enum: StorageType, enumName: 'storage_type', nullable: true })
  storageType: StorageType | null;

  @Column({ name: 'storage_capacity_gb', type: 'int', nullable: true })
  storageCapacityGb: number | null;

  @Column({ name: 'operating_system', type: 'varchar', length: 80, nullable: true })
  operatingSystem: string | null;

  @Column({ type: 'varchar', length: 63, nullable: true })
  hostname: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  // ── Monitor ────────────────────────────────────────────────────────────────
  @Column({ name: 'screen_size_inches', type: 'numeric', precision: 4, scale: 1, nullable: true, transformer: decimal })
  screenSizeInches: number | null;

  // ── Estado (TR §9) ─────────────────────────────────────────────────────────
  @Index()
  @Column({ type: 'enum', enum: EquipmentCondition, enumName: 'equipment_condition', nullable: true })
  condition: EquipmentCondition | null;

  @Column({ name: 'condition_notes', type: 'text', nullable: true })
  conditionNotes: string | null;

  @Column({ name: 'battery_status', type: 'enum', enum: BatteryStatus, enumName: 'battery_status', nullable: true })
  batteryStatus: BatteryStatus | null;

  // ── Problemas (TR §10) ─────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: ProblemType, enumName: 'problem_type', array: true, default: '{}' })
  problems: ProblemType[];

  @Column({ name: 'problem_description', type: 'text', nullable: true })
  problemDescription: string | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  // ── Software (TR §11 — apenas Laptop e Desktop) ───────────────────────────
  @Column({ name: 'updates_status', type: 'enum', enum: UpdatesStatus, enumName: 'updates_status', nullable: true })
  updatesStatus: UpdatesStatus | null;

  @Column({ name: 'eset_status', type: 'enum', enum: EsetStatus, enumName: 'eset_status', nullable: true })
  esetStatus: EsetStatus | null;

  @Column({ name: 'app_issues', type: 'text', nullable: true })
  appIssues: string | null;

  @Column({ name: 'software_notes', type: 'text', nullable: true })
  softwareNotes: string | null;

  /** Informação de software confirmada posteriormente pela equipa de TI */
  @Column({ name: 'software_verified', default: false })
  softwareVerified: boolean;

  // ── Necessidades (indicadores TR §16) ─────────────────────────────────────
  @Column({ name: 'needs_maintenance', default: false })
  needsMaintenance: boolean;

  @Column({ name: 'needs_replacement', default: false })
  needsReplacement: boolean;

  /** Calculado: tem problemas registados ou estado Mau/Não funciona */
  @Index()
  @Column({ name: 'has_problems', default: false })
  hasProblems: boolean;

  /** Calculado: todos os campos obrigatórios preenchidos */
  @Column({ name: 'is_complete', default: false })
  isComplete: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
