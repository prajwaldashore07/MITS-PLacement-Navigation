import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { query } from '../db/pool.js';
import { createSession, clearSessionCookie, requireAuth, requireJsonLogin, csrfGuard } from '../middleware/session.js';
import { asyncRoute, HttpError, validateEmail, validateString } from '../middleware/errors.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: { code: 'LOGIN_RATE_LIMIT', message: 'Too many sign-in attempts. Please wait and try again.' } } });

router.get('/session', asyncRoute(async (req, res) => {
  if (!req.auth) return res.json({ ok: true, authenticated: false });
  if (req.auth.role === 'student') return res.json({ ok: true, authenticated: true, role: 'student', csrfToken: req.auth.csrfToken, student: req.auth.student });
  return res.json({ ok: true, authenticated: true, role: 'admin', csrfToken: req.auth.csrfToken, admin: req.auth.admin });
}));

router.post('/auth/enrollment', loginLimiter, requireJsonLogin, asyncRoute(async (req, res) => {
  const enrollment = validateString(req.body?.enrollmentNumber, 'Enrollment number', { min: 8, max: 32 }).toUpperCase();
  if (!/^[A-Z0-9]+$/.test(enrollment)) throw new HttpError(400, 'VALIDATION_ERROR', 'Use the letters and numbers in your enrollment number.');
  const rows = await query('SELECT s.id,s.enrollment_no,s.full_name,s.branch,s.academic_year,s.batch,s.cgpa,s.onboarding_step,f.active_backlogs FROM students s LEFT JOIN student_academic_facts f ON f.student_id=s.id WHERE s.enrollment_no = ? LIMIT 1', [enrollment]);
  if (!rows[0]) throw new HttpError(404, 'STUDENT_NOT_FOUND', 'No demonstration student matches that enrollment number. Check it and try again.');
  const csrfToken = await createSession(res, { role: 'student', studentId: rows[0].id });
  res.json({ ok: true, authenticated: true, role: 'student', csrfToken, student: rows[0] });
}));

router.post('/auth/admin', loginLimiter, requireJsonLogin, asyncRoute(async (req, res) => {
  const email = validateEmail(req.body?.email);
  const password = validateString(req.body?.password, 'Password', { min: 1, max: 200 });
  const rows = await query('SELECT id,email,full_name,password_hash,is_active FROM admins WHERE email = ? LIMIT 1', [email]);
  const admin = rows[0];
  const valid = admin && admin.is_active && await bcrypt.compare(password, admin.password_hash);
  if (!valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  const csrfToken = await createSession(res, { role: 'admin', adminId: admin.id });
  res.json({ ok: true, authenticated: true, role: 'admin', csrfToken, admin: { id: admin.id, email: admin.email, full_name: admin.full_name } });
}));

router.delete('/auth/logout', requireAuth, csrfGuard, asyncRoute(async (req, res) => {
  await query('DELETE FROM app_sessions WHERE session_hash = ?', [req.auth.sessionHash]);
  clearSessionCookie(res);
  res.json({ ok: true, message: 'Signed out.' });
}));

export default router;
