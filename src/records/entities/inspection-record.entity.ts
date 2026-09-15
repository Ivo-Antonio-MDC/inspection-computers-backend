import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RecordStatus } from '../../common/enums';
import { Collaborator } from '../../collaborators/entities/collaborator.entity';
import { Inspection } from '../../inspections/entities/inspection.entity';
import { User } from '../../users/entities/user.entity';
import { Equipment } from './equipment.entity';

/**
 * Formulário de inspecção: um colaborador → vários equipamentos → um único formulário.
 * Existe no máximo um formulário por colaborador em cada inspecção.
 */
@Entity('inspection_records')
@Index('uq_record_inspection_collaborator', ['inspectionId', 'collaboratorId'], { unique: true })
export class InspectionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Código legível sequencial, ex.: INS-000123 */
  @Column({ type: 'int', unique: true })
  @Generated('increment')
  number: number;

  @Index()
  @Column({ name: 'inspection_id', type: 'uuid' })
  inspectionId: string;

  @ManyToOne(() => Inspection, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inspection_id' })
  inspection: Inspection;

  @Column({ name: 'collaborator_id', type: 'uuid' })
  collaboratorId: string;

  @ManyToOne(() => Collaborator, (c) => c.records, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'collaborator_id' })
  collaborator: Collaborator;

  @Index()
  @Column({ type: 'enum', enum: RecordStatus, enumName: 'record_status', default: RecordStatus.RASCUNHO })
  status: RecordStatus;

  @Column({ name: 'general_notes', type: 'text', nullable: true })
  generalNotes: string | null;

  /** Nº de equipamentos com campos obrigatórios em falta (0 = completo) */
  @Column({ name: 'incomplete_count', type: 'int', default: 0 })
  incompleteCount: number;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'updated_by_id', type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: User | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'validated_by_id', type: 'uuid', nullable: true })
  validatedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'validated_by_id' })
  validatedBy: User | null;

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  /** Comentário da validação ou motivo do pedido de correcção */
  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment: string | null;

  @OneToMany(() => Equipment, (e) => e.record, { cascade: false })
  equipment: Equipment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
