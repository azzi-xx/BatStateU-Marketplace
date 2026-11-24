/**
 * Loads the logged-in user from the session on every request, and provides the
 * route guards. `req.user` is always either a public user object or null.
 */
const userModel = require('../models/user.model');

function attachUser(req, _res, next) {
  req.user = null;

  const userId = req.session && req.session.userId;
  if (userId) {
    const user = userModel.findPublicById(userId);
    if (user && user.status === 'active') {
      user.campus = user.campusId
        ? { id: user.campusId, name: user.campusName, slug: user.campusSlug }
        : null;
      user.organization = String(user.email || '').toLowerCase().endsWith('@g.batstate-u.edu.ph')
        ? 'internal'
        : 'external';
      req.user = user;
    } else {
      delete req.session.userId;
    }
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Please log in to continue.' } });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Please log in to continue.' } });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: { message: 'Admin access only.' } });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
