const requiredVars = ['DATABASE_URL'];

function parseFrontendOrigins(rawValue, nodeEnv) {
  const fallback = nodeEnv === 'development' ? 'http://localhost:5173' : '';
  const raw = String(rawValue || fallback);
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const frontendOrigins = parseFrontendOrigins(process.env.FRONTEND_URL, nodeEnv);
  const tokenTtl = Number(process.env.TOKEN_TTL_SECONDS);
  const maxUploadSize = Number(process.env.MAX_UPLOAD_SIZE_MB);
  const port = Number(process.env.PORT) || 5000;

  const config = {
    NODE_ENV: nodeEnv,
    PORT: port,
    FRONTEND_URL: frontendOrigins[0] || '',
    FRONTEND_URLS: frontendOrigins,
    DATABASE_URL: process.env.DATABASE_URL?.trim() || '',
    ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@zedexam.com').trim().toLowerCase(),
    ADMIN_PASSWORD: String(process.env.ADMIN_PASSWORD || 'admin123').trim(),
    ADMIN_NAME: String(process.env.ADMIN_NAME || 'ZedExam Admin').trim(),
    AUTH_SECRET: String(process.env.AUTH_SECRET || 'zedexam-dev-secret-change-me').trim(),
    TOKEN_TTL_SECONDS: Number.isFinite(tokenTtl) && tokenTtl > 0 ? tokenTtl : 60 * 60 * 24 * 7,
    APP_BASE_URL: String(process.env.APP_BASE_URL || (nodeEnv === 'development' ? `http://localhost:${port}` : '')).trim(),
    UPLOAD_DIR: String(process.env.UPLOAD_DIR || 'uploads').trim(),
    MAX_UPLOAD_SIZE_MB: Number.isFinite(maxUploadSize) && maxUploadSize > 0 ? maxUploadSize : 5,
  };

  const missing = requiredVars.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return config;
}

module.exports = readEnv();
