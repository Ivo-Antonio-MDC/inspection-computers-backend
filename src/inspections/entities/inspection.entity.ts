import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { InspectionStatus } from '../../common/enums';

/**
 * Campanha de inspecção. Todos os registos pertencem a uma inspecção, o que
 * permite reutilizar o sistema em futuras inspecções (TR §18 — Escalabilidade).
 */
@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({
    type: 'enum',
    enum: InspectionStatus,
    enumName: 'inspection_status',
    default: InspectionStatus.PLANEADA,
  })
  status: InspectionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
