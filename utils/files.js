/** Helpers for the files uploaded to public/uploads. */
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

/** Deletes an uploaded image. Silently ignores missing files. */
function removeUpload(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return;
  if (!imagePath.startsWith('/uploads/')) return;

  const fileName = path.basename(imagePath);
  if (!fileName) return;

  fs.promises.unlink(path.join(UPLOAD_DIR, fileName)).catch(() => {});
}

module.exports = { UPLOAD_DIR, removeUpload };
