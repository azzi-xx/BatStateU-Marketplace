const AppError = require('../utils/AppError');
const session = require('../utils/session');
const authService = require('../services/auth.service');
const userModel = require('../models/user.model');

const COOKIE_NAME = 'bsu.sid';

async function register(req, res) {
  const user = await authService.register(req.body);

  // New session id on login/registration prevents session fixation.
  await session.regenerate(req);
  req.session.userId = user.id;
  await session.save(req);

  res.status(201).json({ user });
}

async function login(req, res) {
  const user = await authService.login(req.body);

  await session.regenerate(req);
  req.session.userId = user.id;
  await session.save(req);

  res.json({ user });
}

async function logout(req, res) {
  await session.destroy(req);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
}

function me(req, res) {
  res.json({ user: req.user });
}

function updateMe(req, res) {
  res.json({ user: authService.changeCampus(req.body, req.user) });
}

function heartbeat(req, res) {
  if (!req.user) throw AppError.unauthorized();
  userModel.touchLastSeen(req.user.id);
  res.json({ ok: true });
}

module.exports = { register, login, logout, me, updateMe, heartbeat };
