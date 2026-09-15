import * as bcrypt from 'bcryptjs';
import dataSource from '../data-source';
import { InspectionStatus, LocationModality, UserRole } from '../common/enums';
import { Department } from '../departments/entities/department.entity';
import { Inspection } from '../inspections/entities/inspection.entity';
import { Location } from '../locations/entities/location.entity';
import { User } from '../users/entities/user.entity';

/**
 * Dados iniciais (idempotente — pode ser executado mais do que uma vez):
 *  - Localidades abrangidas (TR §5)
 *  - Equipa de Tecnologia de Informática (TR §6 e §21)
 *  - Departamentos de base (editáveis em Administração)
 *  - Inspecção Geral 2026
 */

const LOCATIONS: { name: string; modality: LocationModality }[] = [
  { name: 'Maputo — Sede', modality: LocationModality.PRESENCIAL },
  { name: 'Tete', modality: LocationModality.REMOTA },
  { name: 'Nacala', modality: LocationModality.REMOTA },
  { name: 'Nampula', modality: LocationModality.REMOTA },
  { name: 'Cuamba', modality: LocationModality.REMOTA },
  { name: 'Beira', modality: LocationModality.REMOTA },
];

// Lista provisória — ajustar à estrutura orgânica da MD Consultores.
const DEPARTMENTS = [
  'Administração',
  'Direcção Geral',
  'Financeiro',
  'Recursos Humanos',
  'Tecnologia de Informática',
  'Projectos',
  'Logística',
  'Operações',
];

const TEAM: { name: string; local: string; role: UserRole }[] = [
  { name: 'Alfredo Nhancole', local: 'alfredo.nhancole', role: UserRole.ADMIN },
  { name: 'Cláudio Manuel', local: 'claudio.manuel', role: UserRole.TECNICO },
  { name: 'Ivo António', local: 'ivo.antonio', role: UserRole.TECNICO },
];

async function run() {
  await dataSource.initialize();
  await dataSource.runMigrations();

  const password = process.env.SEED_DEFAULT_PASSWORD ?? 'Inspeccao@2026';
  const domain = process.env.SEED_EMAIL_DOMAIN ?? 'mdconsultores.co.mz';

  await dataSource.transaction(async (m) => {
    for (const loc of LOCATIONS) {
      if (!(await m.exists(Location, { where: { name: loc.name } }))) {
        await m.insert(Location, loc);
        console.log(`  + Localização: ${loc.name}`);
      }
    }

    for (const name of DEPARTMENTS) {
      if (!(await m.exists(Department, { where: { name } }))) {
        await m.insert(Department, { name });
        console.log(`  + Departamento: ${name}`);
      }
    }

    const hash = await bcrypt.hash(password, 12);
    for (const t of TEAM) {
      const email = `${t.local}@${domain}`;
      if (!(await m.exists(User, { where: { email } }))) {
        await m.insert(User, { name: t.name, email, role: t.role, passwordHash: hash, mustChangePassword: true });
        console.log(`  + Utilizador: ${t.name} <${email}> (${t.role})`);
      }
    }

    const inspectionName = 'Inspecção Geral do Parque Informático 2026';
    if (!(await m.exists(Inspection, { where: { name: inspectionName } }))) {
      await m.insert(Inspection, {
        name: inspectionName,
        description:
          'Levantamento estruturado dos equipamentos informáticos atribuídos aos colaboradores da MD Consultores.',
        status: InspectionStatus.EM_CURSO,
        startDate: '2026-09-15',
      });
      console.log(`  + Inspecção: ${inspectionName}`);
    }
  });

  console.log(`\nSeed concluído. Palavra-passe temporária da equipa: ${password}`);
  console.log('Cada utilizador terá de a alterar no primeiro início de sessão.');
  await dataSource.destroy();
}

run().catch(async (err) => {
  console.error('Falha no seed:', err);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
