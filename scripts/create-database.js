/* Cria a base de dados indicada em DB_NAME caso ainda não exista. Uso: node scripts/create-database.js */
require('dotenv/config');
const { Client } = require('pg');

(async () => {
  const name = process.env.DB_NAME || 'inspeccao_computadores';
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  try {
    await client.connect();
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount) {
      console.log(`Base de dados "${name}" já existe.`);
    } else {
      await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}" ENCODING 'UTF8'`);
      console.log(`Base de dados "${name}" criada.`);
    }
  } catch (err) {
    console.error(`Não foi possível ligar ao PostgreSQL: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
