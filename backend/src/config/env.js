const requiredVars = ['DATABASE_URL'];

function parseFrontendOrigins(rawValue) {
  const raw = String(rawValue || 'http://localhost:5173');
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readEnv() {
  const frontendOrigins = parseFrontendOrigins(process.env.FRONTEND_URL);
  const tokenTtl = Number(process.env.TOKEN_TTL_SECONDS);
  const maxUploadSize = Number(process.env.MAX_UPLOAD_SIZE_MB);

  const config = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 5000,
    FRONTEND_URL: frontendOrigins[0] || 'http://localhost:5173',
    FRONTEND_URLS: frontendOrigins,
    DATABASE_URL: process.env.DATABASE_URL?.trim() || '',
    ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@zedexam.com').trim().toLowerCase(),
    ADMIN_PASSWORD: String(process.env.ADMIN_PASSWORD || 'admin123').trim(),
    ADMIN_NAME: String(process.env.ADMIN_NAME || 'ZedExam Admin').trim(),
    AUTH_SECRET: String(process.env.AUTH_SECRET || 'zedexam-dev-secret-change-me').trim(),
    TOKEN_TTL_SECONDS: Number.isFinite(tokenTtl) && tokenTtl > 0 ? tokenTtl : 60 * 60 * 24 * 7,
    APP_BASE_URL: String(process.env.APP_BASE_URL || `http://localhost:${Number(process.env.PORT) || 5000}`).trim(),
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
