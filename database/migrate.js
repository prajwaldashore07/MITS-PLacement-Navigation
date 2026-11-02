import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../server/db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const lockName = 'mitsplace_schema_migrations';
const migrations = [
  { key: '001_initial_schema', file: 'schema.sql' },
  { key: '002_academic_year_rules', file: 'migrations/002_academic_year_rules.sql' },
  { key: '003_student_achievements', file: 'migrations/003_student_achievements.sql' },
  { key: '004_company_specific_eligibility', file: 'migrations/004_company_specific_eligibility.sql' },
  { key: '005_preparation_recommendations', file: 'migrations/005_preparation_recommendations.sql' },
];

async function statementsFor(file) {
  return (await readFile(path.join(here, file), 'utf8')).split(';').map((part) => part.trim()).filter(Boolean);
}

try {
  const connection = await pool.getConnection();
  let lockHeld = false;
  try {
    // MySQL advisory locking serializes startup migrations even when hot reload or rollout
    // temporarily leaves more than one application process initializing the same schema.
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 45) AS acquired', [lockName]);
    if (Number(lockRows[0]?.acquired) !== 1) throw new Error('Unable to acquire the schema migration lock.');
    lockHeld = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_key VARCHAR(120) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    for (const migration of migrations) {
      const [existing] = await connection.execute('SELECT migration_key FROM schema_migrations WHERE migration_key = ?', [migration.key]);
      if (existing.length) {
        console.log(`Migration ${migration.key} already applied.`);
        continue;
      }
      const statements = await statementsFor(migration.file);
      for (const statement of statements) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations (migration_key) VALUES (?)', [migration.key]);
      console.log(`Applied ${migration.key} (${statements.length} additive statements).`);
    }
  } finally {
    if (lockHeld) {
      try {
        await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch {
        console.warn('Schema migration lock release was not confirmed; the database connection will be closed.');
      }
    }
    connection.release();
  }
} finally {
  await pool.end();
}
