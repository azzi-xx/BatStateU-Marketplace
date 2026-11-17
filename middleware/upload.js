/**
 * Presentation-layer file upload handling (multer).
 * The browser sends multipart/form-data; Express stores the image on disk and
 * the application tier only ever sees `req.file.filename`.
 */
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');
const { UPLOAD_DIR } = require('../utils/files');

const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_TYPES.get(file.mimetype) || path.extname(file.originalname).toLowerCase();
    cb(null, `listing-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    return cb(AppError.badRequest('Please upload a JPG, PNG, WEBP, or GIF image.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

module.exports = { upload };
