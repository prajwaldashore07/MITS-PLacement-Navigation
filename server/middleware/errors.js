export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const known = error instanceof HttpError;
  let status = known ? error.status : 500;
  let code = known ? error.code : 'INTERNAL_ERROR';
  let message = known ? error.message : 'Something went wrong. Please try again.';

  if (!known && (error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE')) {
    status = 413;
    code = error.code === 'LIMIT_FILE_SIZE' ? 'RESUME_TOO_LARGE' : 'BODY_TOO_LARGE';
    message = error.code === 'LIMIT_FILE_SIZE' ? 'The selected PDF exceeds the configured upload limit.' : 'The request is too large.';
  } else if (!known && error?.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400;
    code = 'INVALID_UPLOAD_FIELD';
    message = 'The upload form contains an unexpected file field.';
  } else if (!known && ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR'].includes(error?.code)) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'The database is temporarily unavailable. Try again shortly.';
  } else if (!known && error?.code === 'ER_DUP_ENTRY') {
    status = 409;
    code = 'DUPLICATE_RECORD';
    message = 'That record already exists.';
  }

  if (!known) console.error(JSON.stringify({ event: 'request_error', method: req.method, path: req.path, status, code, errorName: error?.name || 'Error', errorCode: error?.code || undefined }));
  res.status(status).json({ ok: false, error: { code, message, ...(known && error.details ? { details: error.details } : {}) } });
}

export function validateString(value, name, { min = 1, max = 255, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string') throw new HttpError(400, 'VALIDATION_ERROR', `${name} must be text.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) throw new HttpError(400, 'VALIDATION_ERROR', `${name} must be between ${min} and ${max} characters.`);
  return clean;
}

export function validateId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'VALIDATION_ERROR', `${name} is invalid.`);
  return id;
}

export function validateRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 0 || rating > 10) throw new HttpError(400, 'VALIDATION_ERROR', 'Skill ratings must be whole numbers from 0 to 10.');
  return rating;
}

export function validateEmail(value) {
  const email = validateString(value, 'Email', { min: 5, max: 190 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'VALIDATION_ERROR', 'Enter a valid email address.');
  return email;
}
