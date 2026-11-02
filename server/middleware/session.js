import crypto from 'node:crypto';
import { query } from '../db/pool.js';

const COOKIE_NAME = 'mits_session';
const TTL_HOURS = Math.min(168, Math.max(1, Number(process.env.SESSION_TTL_HOURS) || 12));
const COOKIE_SECURE = String(process.env.SESSION_COOKIE_SECURE ?? 'true').toLowerCase() !== 'false';
const COOKIE_SAMESITE = (process.env.SESSION_COOKIE_SAMESITE || (COOKIE_SECURE ? 'none' : 'lax')).toLowerCase();

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieValue(header, name) {
  for (const part of (header || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return null; }
    }
  }
  return null;
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: '/',
    maxAge,
  };
}

export async function createSession(res, { role, studentId = null, adminId = null }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const maxAge = TTL_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAge);
  await query('DELETE FROM app_sessions WHERE expires_at < NOW()');
  await query('INSERT INTO app_sessions (session_hash,role,student_id,admin_id,csrf_token,expires_at) VALUES (?,?,?,?,?,?)', [tokenHash(token),role,studentId,adminId,csrfToken,expiresAt]);
  res.cookie(COOKIE_NAME, token, cookieOptions(maxAge));
  return csrfToken;
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions(0));
}

export async function loadSession(req, res, next) {
  try {
    const token = cookieValue(req.headers.cookie, COOKIE_NAME);
    if (!token || token.length > 100) {
      req.auth = null;
      return next();
    }
    const rows = await query('SELECT session_hash,role,student_id,admin_id,csrf_token,expires_at FROM app_sessions WHERE session_hash = ? AND expires_at > NOW() LIMIT 1', [tokenHash(token)]);
    const row = rows[0];
    if (!row) {
      req.auth = null;
      return next();
    }
    if (row.role === 'student') {
      const students = await query('SELECT s.id,s.enrollment_no,s.full_name,s.branch,s.academic_year,s.batch,s.cgpa,s.onboarding_step,f.active_backlogs FROM students s LEFT JOIN student_academic_facts f ON f.student_id=s.id WHERE s.id = ? LIMIT 1', [row.student_id]);
      if (!students[0]) { req.auth = null; return next(); }
      req.auth = { role: 'student', studentId: row.student_id, student: students[0], csrfToken: row.csrf_token, sessionHash: row.session_hash };
    } else {
      const admins = await query('SELECT id,email,full_name,is_active FROM admins WHERE id = ? AND is_active = TRUE LIMIT 1', [row.admin_id]);
      if (!admins[0]) { req.auth = null; return next(); }
      req.auth = { role: 'admin', adminId: row.admin_id, admin: admins[0], csrfToken: row.csrf_token, sessionHash: row.session_hash };
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req, res, next) {
  if (!req.auth) return res.status(401).json({ ok: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ ok: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
    if (req.auth.role !== role) return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource.' } });
    next();
  };
}

export function csrfGuard(req, res, next) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  if (!req.auth) return res.status(401).json({ ok: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in to continue.' } });
  const supplied = req.get('x-csrf-token') || '';
  const expected = req.auth.csrfToken || '';
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(suppliedBytes, expectedBytes)) {
    return res.status(403).json({ ok: false, error: { code: 'CSRF_INVALID', message: 'Refresh the page and try again.' } });
  }
  next();
}

export function requireJsonLogin(req, res, next) {
  if (!req.is('application/json') || req.get('sec-fetch-site') === 'cross-site') {
    return res.status(415).json({ ok: false, error: { code: 'UNSUPPORTED_REQUEST', message: 'Use a same-site JSON request to sign in.' } });
  }
  next();
}
