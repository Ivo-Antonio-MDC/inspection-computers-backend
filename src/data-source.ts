import 'reflect-metadata';
import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ENTITIES } from './database/entities';

// DataSource usado apenas pela CLI do TypeORM (migration:generate / run / revert)
// e pelo script de seed. A aplicação Nest usa a configuração de app.module.ts.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'inspeccao_computadores',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: ENTITIES,
  migrations: [join(__dirname, 'migrations/*.{ts,js}').replace(/\\/g, '/')],
  synchronize: false,
});
