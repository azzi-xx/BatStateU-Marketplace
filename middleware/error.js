const multer = require('multer');
const AppError = require('../utils/AppError');

/** 404 for unknown /api routes. */
function apiNotFound(_req, res) {
  res.status(404).json({ error: { message: 'API endpoint not found.' } });
}

/**
 * Central error handler. Every layer throws AppError(4xx) for expected
 * problems, so the client always receives { error: { message } }.
 */
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong on the server.';

  if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'That image is larger than 5 MB. Please choose a smaller photo.'
        : 'That upload could not be processed.';
  }

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    message = 'Something went wrong on the server. Please try again.';
  }

  if (req.path.startsWith('/api')) {
    return res.status(status).json({ error: { message } });
  }

  return res.status(status).type('text/plain').send(message);
}

module.exports = { apiNotFound, errorHandler };
