import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LocationModality } from '../../common/enums';

/** Localidades abrangidas pela inspecção (TR §5). */
@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80, unique: true })
  name: string;

  @Column({
    type: 'enum',
    enum: LocationModality,
    enumName: 'location_modality',
    default: LocationModality.REMOTA,
  })
  modality: LocationModality;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
