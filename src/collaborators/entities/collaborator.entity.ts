import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { Location } from '../../locations/entities/location.entity';
import { InspectionRecord } from '../../records/entities/inspection-record.entity';

/** Colaborador da MD Consultores — não é utilizador do sistema (TR §6, §7.1). */
@Entity('collaborators')
@Index('uq_collaborator_name_location', ['nameNormalized', 'locationId'], { unique: true })
export class Collaborator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 160 })
  name: string;

  /** Nome sem acentos/maiúsculas — evita duplicados como "Joao" vs "João" */
  @Column({ name: 'name_normalized', length: 160, select: false })
  nameNormalized: string;

  @Index()
  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => Department, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Index()
  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ length: 120 })
  position: string;

  @OneToMany(() => InspectionRecord, (r) => r.collaborator)
  records: InspectionRecord[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
