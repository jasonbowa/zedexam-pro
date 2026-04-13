const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');

const uploadRoot = path.join(process.cwd(), env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

const upload = multer({
  storage,
  limits: { fileSize: (env.MAX_UPLOAD_SIZE_MB || 5) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, WEBP, and GIF images are allowed'));
    }
    cb(null, true);
  },
});

module.exports = {
  upload,
  uploadRoot,
};
