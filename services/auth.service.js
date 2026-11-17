/**
 * Business logic for registration and login.
 * No Express objects in here — this layer only knows about plain data.
 */
const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const validate = require('../utils/validate');
const userModel = require('../models/user.model');

const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'batstate-u.edu.ph').toLowerCase();
const BCRYPT_ROUNDS = 10;

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    studentId: user.studentId,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    program: user.program,
    yearLevel: user.yearLevel,
    status: user.status,
    createdAt: user.createdAt,
  };
}

async function register(input = {}) {
  const studentId = validate.text(input.studentId, 'Student ID', { min: 4, max: 20 });
  if (!/^[A-Za-z0-9-]+$/.test(studentId)) {
    throw AppError.unprocessable('Student ID may only contain letters, numbers, and dashes (e.g. 22-01234).');
  }

  const fullName = validate.text(input.fullName, 'Full name', { min: 2, max: 80 });
  const email = validate.email(input.email);
  const plainPassword = validate.password(input.password);
  const program = validate.text(input.program, 'Program', { min: 2, max: 40, required: false }) || null;
  const yearLevel = validate.integer(input.yearLevel, 'Year level', { min: 1, max: 6 });

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    throw AppError.unprocessable(`Please register with your @${ALLOWED_DOMAIN} email address.`);
  }
  if (userModel.existsByEmail(email)) {
    throw AppError.conflict('An account with that email already exists.');
  }
  if (userModel.existsByStudentId(studentId)) {
    throw AppError.conflict('An account with that student ID already exists.');
  }

  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

  // Role is never taken from the request body: self-registration is always a student.
  const user = userModel.create({
    studentId,
    fullName,
    email,
    passwordHash,
    role: 'student',
    program,
    yearLevel,
  });

  return toPublicUser(user);
}

async function login(input = {}) {
  const email = validate.email(input.email);
  const plainPassword = String(input.password || '');

  if (!plainPassword) throw AppError.unprocessable('Password is required.');

  const user = userModel.findByEmail(email);

  // Same message for "no such user" and "wrong password" so the API does not
  // reveal which emails are registered.
  const invalid = AppError.unprocessable('Incorrect email or password.');
  if (!user) throw invalid;

  const matches = await bcrypt.compare(plainPassword, user.passwordHash);
  if (!matches) throw invalid;

  if (user.status !== 'active') {
    throw AppError.forbidden('This account has been suspended. Please contact the marketplace admin.');
  }

  userModel.touchLastSeen(user.id);
  return toPublicUser(user);
}

module.exports = { register, login, toPublicUser, ALLOWED_DOMAIN };
