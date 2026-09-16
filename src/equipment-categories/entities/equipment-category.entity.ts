import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Catálogo de equipamentos adicionais (impressora, tablet, projector…).
 * Os equipamentos registados com uma categoria continuam a ser do tipo "outro",
 * com a descrição preenchida com o nome da categoria — as regras de validação,
 * relatórios e exportações não mudam.
 */
@Entity('equipment_categories')
export class EquipmentCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  description: string | null;

  /** Chave do ícone mostrado no formulário (ex.: tablet, impressora). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  icon: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
