import bcrypt from 'bcryptjs';
import { pool } from '../server/db/pool.js';

const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_SEED_NAME?.trim() || 'Placement administrator';
const password = process.env.ADMIN_SEED_PASSWORD;

try {
  if (!email || !password) {
    throw new Error('Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in the environment before running pnpm admin:seed. No default admin credentials are provided.');
  }
  if (password.length < 12) throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters.');
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute('INSERT IGNORE INTO admins (email,full_name,password_hash,is_active) VALUES (?,?,?,TRUE)', [email,name,passwordHash]);
  console.log(result.affectedRows ? `Administrator bootstrap record created for ${email}.` : `Administrator ${email} already exists; existing credentials were left unchanged.`);
} finally {
  await pool.end();
}
