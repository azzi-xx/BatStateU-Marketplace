/**
 * Tiny hand-written validators.
 *
 * Kept dependency-free on purpose: they are easy to read in a code review and
 * they all throw an AppError(422) with a message the UI can show directly.
 */
const AppError = require('./AppError');

function text(value, label, { min = 1, max = 255, required = true } = {}) {
  const raw = value === undefined || value === null ? '' : String(value).trim();

  if (!raw) {
    if (required) throw AppError.unprocessable(`${label} is required.`);
    return '';
  }
  if (raw.length < min) throw AppError.unprocessable(`${label} must be at least ${min} characters.`);
  if (raw.length > max) throw AppError.unprocessable(`${label} must be ${max} characters or fewer.`);
  return raw;
}

function email(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) throw AppError.unprocessable('Email is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw AppError.unprocessable('That does not look like a valid email address.');
  return raw;
}

function password(value) {
  const raw = String(value || '');
  if (raw.length < 8) throw AppError.unprocessable('Password must be at least 8 characters.');
  if (raw.length > 72) throw AppError.unprocessable('Password must be 72 characters or fewer.');
  return raw;
}

/** Accepts "1,250.50" or 1250.5 and returns integer centavos. */
function money(value, label) {
  const cleaned = String(value ?? '').replace(/[₱,\s]/g, '');
  const amount = Number(cleaned);

  if (!Number.isFinite(amount)) throw AppError.unprocessable(`${label} must be a number.`);
  if (amount <= 0) throw AppError.unprocessable(`${label} must be greater than zero.`);
  if (amount > 2_000_000) throw AppError.unprocessable(`${label} cannot be more than ₱2,000,000.`);

  return Math.round(amount * 100);
}

function oneOf(value, allowed, label) {
  const raw = String(value || '').trim();
  if (!allowed.includes(raw)) {
    throw AppError.unprocessable(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return raw;
}

function integer(value, label, { min, max } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n)) throw AppError.unprocessable(`${label} must be a whole number.`);
  if (min !== undefined && n < min) throw AppError.unprocessable(`${label} must be at least ${min}.`);
  if (max !== undefined && n > max) throw AppError.unprocessable(`${label} must be at most ${max}.`);
  return n;
}

module.exports = { text, email, password, money, oneOf, integer };
