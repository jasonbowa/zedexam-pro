const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const env = require('./src/config/env');
const prisma = require('./src/lib/prisma');
const { attachAuth } = require('./src/middleware/auth');

const authRoutes = require('./src/routes/auth.routes');
const subjectsRoutes = require('./src/routes/subjects.routes');
const topicsRoutes = require('./src/routes/topics.routes');
const quizzesRoutes = require('./src/routes/quizzes.routes');
const questionsRoutes = require('./src/routes/questions.routes');
const resultsRoutes = require('./src/routes/results.routes');
const mockExamsRoutes = require('./src/routes/mockExams.routes');
const adminRoutes = require('./src/routes/admin.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const schoolsRoutes = require('./src/routes/schools.routes');
const teachersRoutes = require('./src/routes/teachers.routes');
const subscriptionsRoutes = require('./src/routes/subscriptions.routes');

const app = express();

function escapeRegex(value) {
  return String(value).replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function isAllowedOrigin(origin, allowedPatterns = []) {
  if (!origin) return true;

  return allowedPatterns.some((pattern) => {
    if (!pattern) return false;
    if (pattern === origin) return true;
    if (!String(pattern).includes('*')) return false;

    const regex = new RegExp(`^${escapeRegex(pattern).replace(/\*/g, '.*')}$`);
    return regex.test(origin);
  });
}

const envFrontendUrls = Array.isArray(env.FRONTEND_URLS)
  ? env.FRONTEND_URLS
  : typeof env.FRONTEND_URLS === 'string'
  ? env.FRONTEND_URLS.split(',').map((item) => item.trim()).filter(Boolean)
  : [];

const allowedOrigins = [
  'https://zedexam-pro-necy.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  ...envFrontendUrls,
].filter(Boolean);

const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (isAllowedOrigin(origin, uniqueAllowedOrigins)) {
        return callback(null, true);
      }

      console.error('CORS blocked for origin:', origin);
      console.error('Allowed origins:', uniqueAllowedOrigins);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR || 'uploads')));
app.use(attachAuth);

app.get('/', (_req, res) => {
  return res.json({
    success: true,
    message: 'ZedExam Pro API running',
    environment: env.NODE_ENV,
    version: 'launch-hardened',
  });
});

app.get('/health', (_req, res) => {
  return res.json({
    success: true,
    status: 'ok',
    environment: env.NODE_ENV,
    uploadsEnabled: true,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/mock-exams', mockExamsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, _req, res, _next) => {
  console.error('Global server error:', err);
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: env.NODE_ENV === 'development' ? err.stack || err.message : undefined,
  });
});

const server = app.listen(env.PORT, () => {
  console.log('====================================');
  console.log(`ZedExam Pro backend running on port ${env.PORT}`);
  console.log(`Allowed frontend URLs: ${uniqueAllowedOrigins.join(', ') || 'not configured'}`);
  console.log(`Uploads folder: ${env.UPLOAD_DIR}`);
  console.log('Routes loaded:');
  console.log('- GET /');
  console.log('- GET /health');
  console.log('- /api/auth');
  console.log('- /api/dashboard');
  console.log('- /api/subjects');
  console.log('- /api/topics');
  console.log('- /api/quizzes');
  console.log('- /api/questions');
  console.log('- /api/results');
  console.log('- /api/mock-exams');
  console.log('- /api/admin');
  console.log('- /api/schools');
  console.log('- /api/teachers');
  console.log('- /api/subscriptions');
  console.log('====================================');
});

async function shutdown(signal) {
  console.log(`\n${signal} received. Closing ZedExam Pro backend...`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Prisma disconnected. Server closed cleanly.');
      process.exit(0);
    } catch (error) {
      console.error('Failed during shutdown:', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));