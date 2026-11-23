/**
 * BatStateU Marketplace — server entry point.
 *
 * Layer 1 (presentation) : public/           — HTML, CSS, browser JS
 * Layer 2 (logic)        : routes/, controllers/, services/, middleware/
 * Layer 3 (data)         : models/, config/db.js, database/
 */
require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const session = require('express-session');

const { applySchema, isEmpty, DB_PATH } = require('./config/db');
const { attachUser } = require('./middleware/auth');
const { traceQueries } = require('./middleware/trace');
const { errorHandler } = require('./middleware/error');
const apiRoutes = require('./routes');

applySchema();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_COOKIE = 'bsu.sid';

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(
  session({
    name: SESSION_COOKIE,
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// A few baseline security headers (no extra dependency needed).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Simple request log so you can watch the layers talk during a demo.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});

app.use(traceQueries);
app.use(attachUser);
app.use('/api', apiRoutes);
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Friendly 404 for any page that does not exist.
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: { message: 'API endpoint not found.' } });
  }
  return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log('');
  console.log('  BatStateU Marketplace');
  console.log('  ---------------------');
  console.log(`  Website : http://localhost:${PORT}`);
  console.log(`  API     : http://localhost:${PORT}/api/health`);
  console.log(`  Database: ${DB_PATH}`);
  console.log('');

  if (isEmpty()) {
    console.log('  [!] The database has no users yet.');
    console.log('      Run "npm run seed" in another terminal, then restart the server.');
    console.log('');
  }
});
