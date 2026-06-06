const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const env = require('../config/env');
const { requireAdmin } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  normalizeEmail,
  normalizeGrade,
  listGradeValues,
  normalizePhoneNumber,
  isValidStudentPhoneNumber,
  normalizeQuestionType,
} = require('../utils/normalizers');
const { hashPassword, verifyPassword, shouldUpgradePasswordHash, signToken } = require('../utils/security');
const { toPublicAdmin, toPublicStudent, toPublicTeacherMaterialUser } = require('../utils/serializers');
const { logAdminAction, readAuditLog, appendAuditLog } = require('../utils/audit');
const { getTeacherExpiryDate, resolveTeacherPackage } = require('../utils/accessControl');

const adminLoginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'admin-login' });
const adminWriteLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 40, keyPrefix: 'admin-write' });
const TEACHER_MATERIAL_ACCESS_STATUSES = ['PENDING', 'ACTIVE', 'EXPIRED', 'INACTIVE'];
const TEACHER_MATERIAL_TYPES = ['NOTE', 'GUIDE', 'DOWNLOAD'];
const TEACHER_MATERIAL_CONTENT_STATUSES = ['ACTIVE', 'DRAFT', 'INACTIVE'];
const QUALITY_STATUSES = ['DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED'];
const PROOF_STATUSES = ['PENDING', 'SENT', 'CONFIRMED', 'REJECTED'];

async function getOrCreateQuiz(topicId) {
  const existing = await prisma.quiz.findFirst({ where: { topicId }, orderBy: { id: 'asc' } });
  if (existing) return existing;
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return null;
  return prisma.quiz.create({ data: { title: `${topic.title} Quiz`, topicId } });
}

function buildAdminToken(adminId = 1) {
  return signToken({ id: adminId, role: 'admin', isAdmin: true }, env.AUTH_SECRET, env.TOKEN_TTL_SECONDS);
}

function normalizeBulkRow(q = {}) {
  const questionType = normalizeQuestionType(q.questionType);
  const row = {
    questionType,
    question: String(q.question || '').trim(),
    passage: String(q.passage || '').trim() || null,
    imageUrl: String(q.imageUrl || q.image || '').trim() || null,
    optionA: String(q.optionA || '').trim() || null,
    optionB: String(q.optionB || '').trim() || null,
    optionC: String(q.optionC || '').trim() || null,
    optionD: String(q.optionD || '').trim() || null,
    correctAnswer: String(q.correctAnswer || '').trim() || null,
    answerText: String(q.answerText || '').trim() || null,
    explanation: String(q.explanation || '').trim() || null,
    difficulty: String(q.difficulty || '').trim() || null,
    marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
  };

  const errors = [];
  if (!row.question) errors.push('question missing');
  if (['MCQ', 'PASSAGE_BASED', 'IMAGE_BASED'].includes(questionType)) {
    if (!row.optionA || !row.optionB || !row.optionC || !row.optionD) errors.push('missing options');
    if (!row.correctAnswer) errors.push('correctAnswer missing');
  }
  if (['SHORT_ANSWER', 'STRUCTURED'].includes(questionType) && !row.answerText && !row.correctAnswer) {
    errors.push('answerText or correctAnswer missing');
  }
  if (questionType === 'PASSAGE_BASED' && !row.passage) errors.push('passage missing');
  if (questionType === 'IMAGE_BASED' && !row.imageUrl) errors.push('imageUrl missing');
  return { row, errors };
}

function normalizeStudentStatus(student) {
  if (!student) return 'unknown';
  if (student.deletedAt) return 'deleted';
  const status = String(student.status || '').toLowerCase();
  if (status === 'pending' || status === 'pending_payment') return 'pending_payment';
  if (status === 'suspended') return 'suspended';
  if (student.isActive === false) return 'inactive';
  return 'active';
}

function serializeStudentForAdmin(student) {
  const base = toPublicStudent(student);
  return {
    ...base,
    status: normalizeStudentStatus(student),
    attemptsCount: student._count?.attempts || student.attemptsCount || 0,
    subscriptionsCount: student._count?.subscriptions || student.subscriptionsCount || 0,
  };
}

function normalizeTeacherMaterialAccessStatus(value) {
  const status = String(value || 'PENDING').trim().toUpperCase();
  return TEACHER_MATERIAL_ACCESS_STATUSES.includes(status) ? status : null;
}

function normalizeTeacherMaterialType(value) {
  const type = String(value || 'NOTE').trim().toUpperCase();
  return TEACHER_MATERIAL_TYPES.includes(type) ? type : null;
}

function normalizeTeacherMaterialContentStatus(value) {
  const status = String(value || 'ACTIVE').trim().toUpperCase();
  return TEACHER_MATERIAL_CONTENT_STATUSES.includes(status) ? status : null;
}

function normalizeQualityStatus(value, fallback = 'DRAFT') {
  const status = String(value || fallback).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return QUALITY_STATUSES.includes(status) ? status : null;
}

function normalizeProofStatus(value, fallback = 'PENDING') {
  const status = String(value || fallback).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return PROOF_STATUSES.includes(status) ? status : fallback;
}

function parseOptionalAmount(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function getAdminConfirmationLabel(req) {
  return req.user?.email || req.user?.id ? `admin:${req.user.email || req.user.id}` : 'admin';
}

function getPackageEndDate(startDate, pkg) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(pkg?.durationDays || 30));
  return endDate;
}

async function buildTeacherPackageUpdate(body = {}, existingUser = null) {
  const data = {};
  if (body.packageId !== undefined && body.packageId !== null && body.packageId !== '') {
    const packageId = Number(body.packageId);
    if (!Number.isNaN(packageId) && packageId > 0) {
      const plan = await prisma.subscriptionPackage.findFirst({ where: { id: packageId, active: true } });
      if (plan) {
        data.packageId = plan.id;
        data.package = plan.name;
        return data;
      }
    }
  }

  if (body.package !== undefined) {
    const packageName = String(body.package || '').trim();
    data.package = packageName || null;
    if (packageName) {
      const plan = await prisma.subscriptionPackage.findFirst({ where: { name: packageName, active: true } });
      if (plan) data.packageId = plan.id;
    } else {
      data.packageId = null;
    }
  } else if (existingUser && !existingUser.packageId && existingUser.package) {
    const plan = await resolveTeacherPackage(existingUser);
    if (plan) data.packageId = plan.id;
  }

  return data;
}

function buildPaymentTrackingData(req, proofStatus = 'PENDING', includeNotes = true) {
  const data = { proofStatus: normalizeProofStatus(req.body.proofStatus, proofStatus) };
  const paymentReference = String(req.body.paymentReference || req.body.transactionId || '').trim();
  const amountPaid = parseOptionalAmount(req.body.amountPaid);
  if (paymentReference) data.paymentReference = paymentReference;
  if (amountPaid !== undefined) data.amountPaid = amountPaid;
  if (includeNotes && req.body.notes !== undefined) data.notes = String(req.body.notes || '').trim() || null;
  return data;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function getStudentSubscriptionColumns() {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'StudentSubscription'
  `;
  return new Set(rows.map((row) => row.column_name));
}

function subscriptionColumnExpression(columns, column, alias = column) {
  if (!columns.has(column)) return `NULL AS ${quoteIdentifier(alias)}`;
  return `s.${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}`;
}

async function findPaymentQueueStudentSubscriptions() {
  const columns = await getStudentSubscriptionColumns();
  const whereParts = [];
  if (columns.has('status')) whereParts.push(`s.${quoteIdentifier('status')} IN ('PENDING', 'INACTIVE')`);
  if (columns.has('proofStatus')) whereParts.push(`s.${quoteIdentifier('proofStatus')} IN ('PENDING', 'SENT')`);
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' OR ')}` : '';

  const selectColumns = [
    'id',
    'studentId',
    'packageId',
    'schoolId',
    'sponsorName',
    'status',
    'startDate',
    'endDate',
    'activationCode',
    'paymentReference',
    'amountPaid',
    'proofStatus',
    'confirmedBy',
    'confirmedAt',
    'notes',
    'createdAt',
    'updatedAt',
  ].map((column) => subscriptionColumnExpression(columns, column));

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      ${selectColumns.join(', ')},
      st.id AS "student_id",
      st.name AS "student_name",
      st."phoneNumber" AS "student_phoneNumber",
      st.email AS "student_email",
      st.grade AS "student_grade",
      st."isActive" AS "student_isActive",
      st.status AS "student_status",
      p.id AS "package_id",
      p.name AS "package_name",
      p.description AS "package_description",
      p."durationDays" AS "package_durationDays",
      p."priceZmw" AS "package_priceZmw",
      p."maxSubjects" AS "package_maxSubjects",
      p."maxMockExams" AS "package_maxMockExams",
      p."includesReports" AS "package_includesReports",
      p."includesCertificates" AS "package_includesCertificates",
      p.active AS "package_active",
      sc.id AS "school_id",
      sc.name AS "school_name"
    FROM ${quoteIdentifier('StudentSubscription')} s
    LEFT JOIN ${quoteIdentifier('Student')} st ON st.id = s.${quoteIdentifier('studentId')}
    LEFT JOIN ${quoteIdentifier('SubscriptionPackage')} p ON p.id = s.${quoteIdentifier('packageId')}
    LEFT JOIN ${quoteIdentifier('School')} sc ON ${columns.has('schoolId') ? `sc.id = s.${quoteIdentifier('schoolId')}` : 'false'}
    ${whereSql}
    ORDER BY ${columns.has('createdAt') ? `s.${quoteIdentifier('createdAt')}` : 's.id'} DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    packageId: row.packageId,
    schoolId: row.schoolId,
    sponsorName: row.sponsorName,
    status: row.status || 'PENDING',
    startDate: row.startDate,
    endDate: row.endDate,
    activationCode: row.activationCode,
    paymentReference: row.paymentReference || null,
    amountPaid: row.amountPaid,
    proofStatus: row.proofStatus || 'PENDING',
    confirmedBy: row.confirmedBy,
    confirmedAt: row.confirmedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    student: row.student_id
      ? {
          id: row.student_id,
          name: row.student_name,
          phoneNumber: row.student_phoneNumber,
          phone: row.student_phoneNumber,
          email: row.student_email,
          grade: row.student_grade,
          isActive: row.student_isActive,
          status: row.student_status,
        }
      : null,
    package: row.package_id
      ? {
          id: row.package_id,
          name: row.package_name,
          description: row.package_description,
          durationDays: row.package_durationDays,
          priceZmw: row.package_priceZmw,
          maxSubjects: row.package_maxSubjects,
          maxMockExams: row.package_maxMockExams,
          includesReports: row.package_includesReports,
          includesCertificates: row.package_includesCertificates,
          active: row.package_active,
        }
      : null,
    school: row.school_id ? { id: row.school_id, name: row.school_name } : null,
  }));
}

function serializeTeacherMaterialUserForAdmin(user) {
  const base = toPublicTeacherMaterialUser(user);
  return {
    ...base,
    status: String(base.status || 'PENDING').toUpperCase(),
    accessLabel: base.isActive ? 'Active' : 'Needs activation',
    proofStatus: base.proofStatus || 'PENDING',
    paymentReference: base.paymentReference || null,
    amountPaid: base.amountPaid || null,
    confirmedBy: base.confirmedBy || null,
    confirmedAt: base.confirmedAt || null,
  };
}

function csvValue(value) {
  if (value === undefined || value === null) return '';
  const normalized = value instanceof Date ? value.toISOString() : String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function csvDate(value) {
  return value ? new Date(value).toISOString() : '';
}

function csvAmount(value) {
  if (value === undefined || value === null || value === '') return '';
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : String(value);
}

function buildCsv(headers, rows) {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(',')),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

function sendCsv(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buildCsv(headers, rows));
}

function buildTeacherMaterialPayload(body = {}) {
  const materialType = normalizeTeacherMaterialType(body.materialType || body.type);
  const status = normalizeTeacherMaterialContentStatus(body.status);
  const qualityStatus = normalizeQualityStatus(body.qualityStatus, 'DRAFT');
  const payload = {
    title: String(body.title || '').trim(),
    materialType,
    subject: String(body.subject || '').trim() || null,
    grade: String(body.grade || body.form || '').trim() || null,
    topic: String(body.topic || '').trim() || null,
    summary: String(body.summary || body.content || '').trim() || null,
    learningObjectives: String(body.learningObjectives || '').trim() || null,
    keyConcepts: String(body.keyConcepts || '').trim() || null,
    suggestedTeachingMethod: String(body.suggestedTeachingMethod || '').trim() || null,
    commonLearnerDifficulties: String(body.commonLearnerDifficulties || '').trim() || null,
    assessmentQuestions: String(body.assessmentQuestions || '').trim() || null,
    markingGuide: String(body.markingGuide || body.answers || '').trim() || null,
    downloadUrl: String(body.downloadUrl || body.fileUrl || '').trim() || null,
    status,
    qualityStatus,
  };

  const errors = [];
  if (!payload.title) errors.push('Title is required');
  if (!payload.materialType) errors.push(`materialType must be one of: ${TEACHER_MATERIAL_TYPES.join(', ')}`);
  if (!payload.status) errors.push(`status must be one of: ${TEACHER_MATERIAL_CONTENT_STATUSES.join(', ')}`);
  if (!payload.qualityStatus) errors.push(`qualityStatus must be one of: ${QUALITY_STATUSES.join(', ')}`);

  return { payload, errors };
}

async function resolveSchool(schoolId) {
  if (schoolId === undefined || schoolId === null || schoolId === '') {
    return { schoolId: null, schoolName: null };
  }

  const parsedSchoolId = Number(schoolId);
  if (Number.isNaN(parsedSchoolId) || parsedSchoolId < 1) {
    return { error: 'Invalid schoolId' };
  }

  const school = await prisma.school.findUnique({ where: { id: parsedSchoolId } });
  if (!school) {
    return { error: 'Selected school was not found' };
  }

  return { schoolId: school.id, schoolName: school.name };
}

async function findStudentOr404(res, studentId, include = {}) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include });
  if (!student) {
    res.status(404).json({ message: 'Student not found' });
    return null;
  }
  return student;
}

function buildStudentWhere(query = {}) {
  const search = String(query.search || '').trim();
  const status = String(query.status || '').trim().toLowerCase();
  const grade = normalizeGrade(query.grade);
  const includeDeleted = String(query.includeDeleted || '').trim().toLowerCase() === 'true';

  const where = {};

  if (!includeDeleted) {
    where.deletedAt = null;
  }

  if (grade) {
    where.grade = grade;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phoneNumber: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { school: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status === 'active') {
    where.isActive = true;
    where.deletedAt = null;
  } else if (status === 'pending_payment') {
    where.status = { in: ['pending', 'pending_payment'] };
    where.deletedAt = null;
  } else if (status === 'suspended') {
    where.status = 'suspended';
    where.deletedAt = null;
  } else if (status === 'inactive') {
    where.isActive = false;
    where.status = { notIn: ['pending', 'pending_payment', 'suspended', 'deleted'] };
    where.deletedAt = null;
  } else if (status === 'deleted') {
    where.deletedAt = { not: null };
  }

  return where;
}

router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const normalizedEmail = normalizeEmail(email);
    const providedPassword = String(password).trim();
    const admin = await prisma.admin.findUnique({ where: { email: normalizedEmail } });

    if (admin && verifyPassword(providedPassword, admin.password)) {
      if (shouldUpgradePasswordHash(admin.password)) {
        await prisma.admin.update({ where: { id: admin.id }, data: { password: hashPassword(providedPassword) } });
      }
      appendAuditLog('admin_login_success', { actorId: admin.id, identifier: normalizedEmail, ip: req.ip });
      return res.json({ message: 'Admin login successful', token: buildAdminToken(admin.id), admin: { ...toPublicAdmin(admin), role: admin.role || 'Administrator' } });
    }

    if (normalizedEmail === env.ADMIN_EMAIL && verifyPassword(providedPassword, env.ADMIN_PASSWORD)) {
      appendAuditLog('admin_env_login_success', { actorId: 1, identifier: normalizedEmail, ip: req.ip });
      return res.json({ message: 'Admin login successful', token: buildAdminToken(1), admin: { id: 1, name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, role: 'Administrator' } });
    }

    appendAuditLog('admin_login_failed', { identifier: normalizedEmail, ip: req.ip });
    return res.status(401).json({ message: 'Invalid admin credentials' });
  } catch (error) {
    console.error('POST /api/admin/login error:', error);
    return res.status(500).json({ message: 'Admin login failed' });
  }
});

router.use(requireAdmin);

router.get('/', async (_req, res) => {
  try {
    const [students, activeStudents, inactiveStudents, deletedStudents, subjects, topics, questions, quizzes, attempts, mockExams] = await Promise.all([
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.student.count({ where: { deletedAt: null, isActive: true } }),
      prisma.student.count({ where: { deletedAt: null, isActive: false } }),
      prisma.student.count({ where: { deletedAt: { not: null } } }),
      prisma.subject.count(),
      prisma.topic.count(),
      prisma.question.count(),
      prisma.quiz.count(),
      prisma.quizAttempt.count(),
      prisma.mockExam.count(),
    ]);

    return res.json({
      message: 'Admin route working',
      stats: { students, activeStudents, inactiveStudents, deletedStudents, subjects, topics, questions, quizzes, attempts, mockExams },
    });
  } catch (error) {
    console.error('GET /api/admin error:', error);
    return res.status(500).json({ message: 'Failed to load admin route' });
  }
});

router.get('/export/:type', async (req, res) => {
  const type = String(req.params.type || '').trim().toLowerCase();
  const dateTag = new Date().toISOString().slice(0, 10);

  try {
    if (type === 'students') {
      const students = await prisma.student.findMany({
        orderBy: [{ createdAt: 'desc' }],
        include: { schoolRecord: true, _count: { select: { attempts: true, subscriptions: true } } },
      });
      const headers = ['id', 'name', 'phoneNumber', 'email', 'grade', 'school', 'status', 'isActive', 'attemptsCount', 'subscriptionsCount', 'createdAt', 'updatedAt'];
      const rows = students.map((student) => ({
        id: student.id,
        name: student.name,
        phoneNumber: student.phoneNumber,
        email: student.email || '',
        grade: student.grade || '',
        school: student.schoolRecord?.name || student.school || '',
        status: normalizeStudentStatus(student),
        isActive: student.isActive ? 'TRUE' : 'FALSE',
        attemptsCount: student._count?.attempts || 0,
        subscriptionsCount: student._count?.subscriptions || 0,
        createdAt: csvDate(student.createdAt),
        updatedAt: csvDate(student.updatedAt),
      }));
      logAdminAction(req, 'admin_csv_exported', { type, rows: rows.length });
      return sendCsv(res, `zedexam-students-${dateTag}.csv`, headers, rows);
    }

    if (type === 'subscriptions') {
      const subscriptions = await prisma.studentSubscription.findMany({
        orderBy: [{ createdAt: 'desc' }],
        include: { student: true, package: true, school: true },
      });
      const headers = ['id', 'studentName', 'studentPhone', 'packageName', 'packagePriceZmw', 'status', 'proofStatus', 'paymentReference', 'amountPaid', 'startDate', 'endDate', 'confirmedBy', 'confirmedAt', 'notes', 'createdAt'];
      const rows = subscriptions.map((item) => ({
        id: item.id,
        studentName: item.student?.name || '',
        studentPhone: item.student?.phoneNumber || '',
        packageName: item.package?.name || '',
        packagePriceZmw: csvAmount(item.package?.priceZmw),
        status: item.status || '',
        proofStatus: item.proofStatus || '',
        paymentReference: item.paymentReference || '',
        amountPaid: csvAmount(item.amountPaid),
        startDate: csvDate(item.startDate),
        endDate: csvDate(item.endDate),
        confirmedBy: item.confirmedBy || '',
        confirmedAt: csvDate(item.confirmedAt),
        notes: item.notes || '',
        createdAt: csvDate(item.createdAt),
      }));
      logAdminAction(req, 'admin_csv_exported', { type, rows: rows.length });
      return sendCsv(res, `zedexam-student-subscriptions-${dateTag}.csv`, headers, rows);
    }

    if (type === 'teacher-material-users') {
      const users = await prisma.teacherMaterialUser.findMany({ orderBy: [{ createdAt: 'desc' }] });
      const headers = ['id', 'name', 'phone', 'email', 'package', 'status', 'isActive', 'proofStatus', 'paymentReference', 'amountPaid', 'activatedAt', 'expiresAt', 'confirmedBy', 'confirmedAt', 'createdAt'];
      const rows = users.map((user) => ({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email || '',
        package: user.package || '',
        status: user.status || '',
        isActive: user.isActive ? 'TRUE' : 'FALSE',
        proofStatus: user.proofStatus || '',
        paymentReference: user.paymentReference || '',
        amountPaid: csvAmount(user.amountPaid),
        activatedAt: csvDate(user.activatedAt),
        expiresAt: csvDate(user.expiresAt),
        confirmedBy: user.confirmedBy || '',
        confirmedAt: csvDate(user.confirmedAt),
        createdAt: csvDate(user.createdAt),
      }));
      logAdminAction(req, 'admin_csv_exported', { type, rows: rows.length });
      return sendCsv(res, `zedexam-teacher-material-users-${dateTag}.csv`, headers, rows);
    }

    if (type === 'packages') {
      const packages = await prisma.subscriptionPackage.findMany({ orderBy: [{ priceZmw: 'asc' }] });
      const headers = ['id', 'name', 'description', 'durationDays', 'priceZmw', 'maxSubjects', 'maxMockExams', 'includesReports', 'includesCertificates', 'active', 'createdAt'];
      const rows = packages.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        durationDays: item.durationDays,
        priceZmw: csvAmount(item.priceZmw),
        maxSubjects: item.maxSubjects ?? '',
        maxMockExams: item.maxMockExams ?? '',
        includesReports: item.includesReports ? 'TRUE' : 'FALSE',
        includesCertificates: item.includesCertificates ? 'TRUE' : 'FALSE',
        active: item.active ? 'TRUE' : 'FALSE',
        createdAt: csvDate(item.createdAt),
      }));
      logAdminAction(req, 'admin_csv_exported', { type, rows: rows.length });
      return sendCsv(res, `zedexam-packages-${dateTag}.csv`, headers, rows);
    }

    if (type === 'content-materials') {
      const materials = await prisma.contentMaterial.findMany({
        orderBy: [{ createdAt: 'desc' }],
        include: { subject: true, topic: true },
      });
      const headers = ['id', 'title', 'subject', 'grade', 'topic', 'contentType', 'audience', 'accessLevel', 'status', 'qualityStatus', 'hasImage', 'hasPdf', 'hasTeacherGuidePdf', 'createdAt', 'updatedAt'];
      const rows = materials.map((item) => ({
        id: item.id,
        title: item.title,
        subject: item.subjectName || item.subject?.name || '',
        grade: item.grade || item.subject?.grade || '',
        topic: item.topicTitle || item.topic?.title || '',
        contentType: item.contentType || '',
        audience: item.audience || '',
        accessLevel: item.accessLevel || '',
        status: item.status || '',
        qualityStatus: item.qualityStatus || '',
        hasImage: item.imageUrl ? 'TRUE' : 'FALSE',
        hasPdf: item.pdfUrl ? 'TRUE' : 'FALSE',
        hasTeacherGuidePdf: item.teacherGuidePdfUrl ? 'TRUE' : 'FALSE',
        createdAt: csvDate(item.createdAt),
        updatedAt: csvDate(item.updatedAt),
      }));
      logAdminAction(req, 'admin_csv_exported', { type, rows: rows.length });
      return sendCsv(res, `zedexam-content-materials-${dateTag}.csv`, headers, rows);
    }

    if (type === 'teacher-materials') {
      const materials = await prisma.teacherMaterial.findMany({ orderBy: [{ createdAt: 'desc' }] });
      const headers = ['id', 'title', 'materialType', 'subject', 'grade', 'topic', 'status', 'qualityStatus', 'hasDownload', 'createdAt', 'updatedAt'];
      const rows = materials.map((item) => ({
        id: item.id,
        title: item.title,
        materialType: item.materialType || '',
        subject: item.subject || '',
        grade: item.grade || '',
        topic: item.topic || '',
        status: item.status || '',
        qualityStatus: item.qualityStatus || '',
        hasDownload: item.downloadUrl ? 'TRUE' : 'FALSE',
        createdAt: csvDate(item.createdAt),
        updatedAt: csvDate(item.updatedAt),
      }));
      logAdminAction(req, 'admin_csv_exported', { type, rows: rows.length });
      return sendCsv(res, `zedexam-teacher-materials-${dateTag}.csv`, headers, rows);
    }

    return res.status(404).json({
      message: 'Unknown export type',
      supportedTypes: ['students', 'subscriptions', 'teacher-material-users', 'packages', 'content-materials', 'teacher-materials'],
    });
  } catch (error) {
    console.error(`GET /api/admin/export/${type} error:`, error);
    return res.status(500).json({ message: 'Failed to export admin data' });
  }
});

router.get('/payment-queue', async (_req, res) => {
  try {
    const studentSubscriptions = await findPaymentQueueStudentSubscriptions();

    const teacherUsers = await prisma.teacherMaterialUser.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'INACTIVE' },
          { proofStatus: { in: ['PENDING', 'SENT'] } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return res.json({
      students: studentSubscriptions,
      teachers: teacherUsers.map(serializeTeacherMaterialUserForAdmin),
      counts: {
        students: studentSubscriptions.length,
        teachers: teacherUsers.length,
        total: studentSubscriptions.length + teacherUsers.length,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/payment-queue error:', error);
    return res.status(500).json({ message: 'Failed to load payment queue' });
  }
});

router.patch('/payment-queue/student-subscriptions/:id/activate', adminWriteLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid subscription id' });

    const existing = await prisma.studentSubscription.findUnique({ where: { id }, include: { package: true } });
    if (!existing) return res.status(404).json({ message: 'Subscription not found' });

    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
    const subscription = await prisma.$transaction(async (tx) => {
      const updated = await tx.studentSubscription.update({
        where: { id },
        data: {
          ...buildPaymentTrackingData(req, 'CONFIRMED', false),
          status: 'ACTIVE',
          startDate,
          endDate: getPackageEndDate(startDate, existing.package),
          confirmedBy: getAdminConfirmationLabel(req),
          confirmedAt: new Date(),
        },
        include: { student: true, package: true, school: true },
      });

      const student = await tx.student.update({
        where: { id: updated.studentId },
        data: { isActive: true, status: 'active', deactivatedAt: null },
      });

      return { ...updated, student };
    });

    logAdminAction(req, 'payment_queue_student_activated', { subscriptionId: id, studentId: subscription.studentId, packageId: subscription.packageId });
    return res.json({ message: 'Student package activated after payment confirmation', subscription });
  } catch (error) {
    console.error('PATCH /api/admin/payment-queue/student-subscriptions/:id/activate error:', error);
    return res.status(500).json({ message: 'Failed to activate student package' });
  }
});

router.patch('/payment-queue/student-subscriptions/:id/deactivate', adminWriteLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid subscription id' });

    const subscription = await prisma.$transaction(async (tx) => {
      const updated = await tx.studentSubscription.update({
        where: { id },
        data: {
          ...buildPaymentTrackingData(req, 'REJECTED', false),
          status: 'INACTIVE',
          startDate: null,
          endDate: null,
          confirmedBy: null,
          confirmedAt: null,
        },
        include: { student: true, package: true, school: true },
      });

      const activeCount = await tx.studentSubscription.count({
        where: { studentId: updated.studentId, status: 'ACTIVE', id: { not: id } },
      });
      if (activeCount === 0) {
        const student = await tx.student.update({
          where: { id: updated.studentId },
          data: { isActive: false, status: 'suspended', deactivatedAt: new Date() },
        });
        return { ...updated, student };
      }

      return updated;
    });

    logAdminAction(req, 'payment_queue_student_deactivated', { subscriptionId: id, studentId: subscription.studentId, packageId: subscription.packageId });
    return res.json({ message: 'Student package deactivated', subscription });
  } catch (error) {
    console.error('PATCH /api/admin/payment-queue/student-subscriptions/:id/deactivate error:', error);
    return res.status(500).json({ message: 'Failed to deactivate student package' });
  }
});

router.patch('/payment-queue/teacher-material-users/:id/activate', adminWriteLimiter, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Invalid Teacher Materials user ID' });
    const existingUser = await prisma.teacherMaterialUser.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ message: 'Teacher Materials user not found' });
    const activatedAt = new Date();
    const packageUpdate = await buildTeacherPackageUpdate(req.body, existingUser);

    const user = await prisma.teacherMaterialUser.update({
      where: { id },
      data: {
        ...packageUpdate,
        ...buildPaymentTrackingData(req, 'CONFIRMED', false),
        status: 'ACTIVE',
        isActive: true,
        activatedAt,
        expiresAt: await getTeacherExpiryDate({ ...existingUser, ...packageUpdate }, activatedAt, req.body.expiresAt),
        confirmedBy: getAdminConfirmationLabel(req),
        confirmedAt: new Date(),
      },
    });

    logAdminAction(req, 'payment_queue_teacher_activated', { teacherMaterialUserId: id });
    return res.json({ message: 'Teacher Materials access activated after payment confirmation', user: serializeTeacherMaterialUserForAdmin(user) });
  } catch (error) {
    console.error('PATCH /api/admin/payment-queue/teacher-material-users/:id/activate error:', error);
    return res.status(500).json({ message: 'Failed to activate Teacher Materials access' });
  }
});

router.patch('/payment-queue/teacher-material-users/:id/deactivate', adminWriteLimiter, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Invalid Teacher Materials user ID' });

    const user = await prisma.teacherMaterialUser.update({
      where: { id },
      data: {
        ...buildPaymentTrackingData(req, 'REJECTED', false),
        status: 'INACTIVE',
        isActive: false,
        activatedAt: null,
        expiresAt: null,
        confirmedBy: null,
        confirmedAt: null,
      },
    });

    logAdminAction(req, 'payment_queue_teacher_deactivated', { teacherMaterialUserId: id });
    return res.json({ message: 'Teacher Materials access deactivated', user: serializeTeacherMaterialUserForAdmin(user) });
  } catch (error) {
    console.error('PATCH /api/admin/payment-queue/teacher-material-users/:id/deactivate error:', error);
    return res.status(500).json({ message: 'Failed to deactivate Teacher Materials access' });
  }
});

router.get('/students', async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      where: buildStudentWhere(req.query),
      orderBy: [{ deletedAt: 'asc' }, { isActive: 'desc' }, { id: 'desc' }],
      include: { _count: { select: { attempts: true, subscriptions: true } } },
    });

    return res.json(students.map(serializeStudentForAdmin));
  } catch (error) {
    console.error('GET /api/admin/students error:', error);
    return res.status(500).json({ message: 'Failed to fetch students' });
  }
});

router.get('/students/:id', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

    const student = await findStudentOr404(res, studentId, {
      _count: { select: { attempts: true, subscriptions: true } },
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { package: { select: { id: true, name: true, priceZmw: true, durationDays: true } } },
      },
      attempts: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, score: true, total: true, quizTitle: true, createdAt: true, mockExamId: true },
      },
    });
    if (!student) return;

    return res.json(serializeStudentForAdmin(student));
  } catch (error) {
    console.error('GET /api/admin/students/:id error:', error);
    return res.status(500).json({ message: 'Failed to fetch student details' });
  }
});

router.post('/students', adminWriteLimiter, async (req, res) => {
  try {
    const { name, email, phoneNumber, phone, password, grade, school, schoolId, isActive } = req.body;

    const trimmedName = String(name || '').trim();
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhoneNumber(phoneNumber || phone);
    const trimmedPassword = String(password || '').trim();
    const normalizedGrade = normalizeGrade(grade);
    const trimmedSchool = String(school || '').trim() || null;

    if (!trimmedName || !normalizedPhone || !trimmedPassword || !normalizedGrade) {
      return res.status(400).json({
        message: `Name, phone number, password, and a valid grade are required. Allowed grades: ${listGradeValues().join(', ')}`,
      });
    }

    if (!isValidStudentPhoneNumber(normalizedPhone)) {
      return res.status(400).json({ message: 'Please enter a valid student phone number, for example 0977123456' });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const schoolResolution = await resolveSchool(schoolId);
    if (schoolResolution.error) return res.status(400).json({ message: schoolResolution.error });

    const existing = await prisma.student.findFirst({
      where: {
        OR: [
          { phoneNumber: normalizedPhone },
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ message: 'A student with this phone number or email already exists' });
    }

    const activeFlag = isActive !== false && String(isActive).toLowerCase() !== 'false';
    const student = await prisma.student.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        password: hashPassword(trimmedPassword),
        grade: normalizedGrade,
        school: schoolResolution.schoolName || trimmedSchool,
        schoolId: schoolResolution.schoolId,
        isActive: activeFlag,
        status: activeFlag ? 'active' : 'inactive',
        deactivatedAt: activeFlag ? null : new Date(),
      },
      include: { _count: { select: { attempts: true, subscriptions: true } } },
    });

    logAdminAction(req, 'student_created', { studentId: student.id });
    return res.status(201).json({ message: 'Student created successfully', student: serializeStudentForAdmin(student) });
  } catch (error) {
    console.error('POST /api/admin/students error:', error);
    return res.status(500).json({ message: 'Failed to create student' });
  }
});

router.patch('/students/:id', adminWriteLimiter, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

    const existing = await findStudentOr404(res, studentId);
    if (!existing) return;

    const data = {};

    if (req.body.name !== undefined) {
      const trimmedName = String(req.body.name || '').trim();
      if (!trimmedName) return res.status(400).json({ message: 'Student name cannot be empty' });
      data.name = trimmedName;
    }

    if (req.body.email !== undefined) {
      const normalizedEmail = normalizeEmail(req.body.email);
      if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }

      const duplicate = normalizedEmail
        ? await prisma.student.findFirst({ where: { email: normalizedEmail, id: { not: studentId } } })
        : null;
      if (duplicate) return res.status(409).json({ message: 'Another student already uses that email address' });
      data.email = normalizedEmail;
    }

    if (req.body.phoneNumber !== undefined || req.body.phone !== undefined) {
      const normalizedPhone = normalizePhoneNumber(req.body.phoneNumber || req.body.phone);
      if (!isValidStudentPhoneNumber(normalizedPhone)) {
        return res.status(400).json({ message: 'Please enter a valid student phone number, for example 0977123456' });
      }
      const duplicate = await prisma.student.findFirst({ where: { phoneNumber: normalizedPhone, id: { not: studentId } } });
      if (duplicate) return res.status(409).json({ message: 'Another student already uses that phone number' });
      data.phoneNumber = normalizedPhone;
    }

    if (req.body.grade !== undefined) {
      const normalizedGrade = normalizeGrade(req.body.grade);
      if (!normalizedGrade) {
        return res.status(400).json({ message: `Invalid grade. Allowed grades: ${listGradeValues().join(', ')}` });
      }
      data.grade = normalizedGrade;
    }

    if (req.body.school !== undefined) {
      data.school = String(req.body.school || '').trim() || null;
    }

    if (req.body.schoolId !== undefined) {
      const schoolResolution = await resolveSchool(req.body.schoolId);
      if (schoolResolution.error) return res.status(400).json({ message: schoolResolution.error });
      data.schoolId = schoolResolution.schoolId;
      if (!req.body.school) data.school = schoolResolution.schoolName;
    }

    if (req.body.password !== undefined) {
      const trimmedPassword = String(req.body.password || '').trim();
      if (trimmedPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      data.password = hashPassword(trimmedPassword);
    }

    if (req.body.isActive !== undefined) {
      const activeFlag = req.body.isActive === true || String(req.body.isActive).toLowerCase() === 'true';
      data.isActive = activeFlag;
      data.status = activeFlag ? 'active' : 'inactive';
      data.deactivatedAt = activeFlag ? null : new Date();
    }

    const student = await prisma.student.update({
      where: { id: studentId },
      data,
      include: { _count: { select: { attempts: true, subscriptions: true } } },
    });

    logAdminAction(req, 'student_updated', { studentId });
    return res.json({ message: 'Student updated successfully', student: serializeStudentForAdmin(student) });
  } catch (error) {
    console.error('PATCH /api/admin/students/:id error:', error);
    return res.status(500).json({ message: 'Failed to update student' });
  }
});

router.patch('/students/:id/activate', adminWriteLimiter, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

    const existing = await findStudentOr404(res, studentId, { _count: { select: { attempts: true, subscriptions: true } } });
    if (!existing) return;
    if (existing.deletedAt) return res.status(400).json({ message: 'Restore this student before activating the account' });

    const student = await prisma.student.update({
      where: { id: studentId },
      data: { isActive: true, status: 'active', deactivatedAt: null },
      include: { _count: { select: { attempts: true, subscriptions: true } } },
    });

    logAdminAction(req, 'student_activated', { studentId });
    return res.json({ message: 'Student activated successfully', student: serializeStudentForAdmin(student) });
  } catch (error) {
    console.error('PATCH /api/admin/students/:id/activate error:', error);
    return res.status(500).json({ message: 'Failed to activate student' });
  }
});

router.patch('/students/:id/deactivate', adminWriteLimiter, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

    const existing = await findStudentOr404(res, studentId, { _count: { select: { attempts: true, subscriptions: true } } });
    if (!existing) return;
    if (existing.deletedAt) return res.status(400).json({ message: 'This student has already been removed' });

    const student = await prisma.student.update({
      where: { id: studentId },
      data: { isActive: false, status: 'inactive', deactivatedAt: new Date() },
      include: { _count: { select: { attempts: true, subscriptions: true } } },
    });

    logAdminAction(req, 'student_deactivated', { studentId });
    return res.json({ message: 'Student deactivated successfully', student: serializeStudentForAdmin(student) });
  } catch (error) {
    console.error('PATCH /api/admin/students/:id/deactivate error:', error);
    return res.status(500).json({ message: 'Failed to deactivate student' });
  }
});

router.patch('/students/:id/restore', adminWriteLimiter, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

    const existing = await findStudentOr404(res, studentId, { _count: { select: { attempts: true, subscriptions: true } } });
    if (!existing) return;

    const student = await prisma.student.update({
      where: { id: studentId },
      data: { deletedAt: null, isActive: true, status: 'active', deactivatedAt: null },
      include: { _count: { select: { attempts: true, subscriptions: true } } },
    });

    logAdminAction(req, 'student_restored', { studentId });
    return res.json({ message: 'Student restored successfully', student: serializeStudentForAdmin(student) });
  } catch (error) {
    console.error('PATCH /api/admin/students/:id/restore error:', error);
    return res.status(500).json({ message: 'Failed to restore student' });
  }
});

router.patch('/students/:id/reset-password', adminWriteLimiter, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

    const nextPassword = String(req.body.password || '').trim();
    if (nextPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const student = await prisma.student.update({
      where: { id: studentId },
      data: { password: hashPassword(nextPassword) },
      include: { _count: { select: { attempts: true, subscriptions: true } } },
    });

    logAdminAction(req, 'student_password_reset', { studentId });
    return res.json({ message: 'Student password reset successfully', student: serializeStudentForAdmin(student) });
  } catch (error) {
    console.error('PATCH /api/admin/students/:id/reset-password error:', error);
    return res.status(500).json({ message: 'Failed to reset student password' });
  }
});

router.delete('/students/:id', adminWriteLimiter, async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

    const hardDelete = String(req.query.hard || '').toLowerCase() === 'true';
    const existing = await findStudentOr404(res, studentId);
    if (!existing) return;

    if (hardDelete) {
      await prisma.student.delete({ where: { id: studentId } });
      logAdminAction(req, 'student_hard_deleted', { studentId });
      return res.json({ message: 'Student permanently deleted' });
    }

    const student = await prisma.student.update({
      where: { id: studentId },
      data: {
        isActive: false,
        status: 'deleted',
        deactivatedAt: existing.deactivatedAt || new Date(),
        deletedAt: new Date(),
      },
      include: { _count: { select: { attempts: true, subscriptions: true } } },
    });

    logAdminAction(req, 'student_soft_deleted', { studentId });
    return res.json({ message: 'Student removed successfully', student: serializeStudentForAdmin(student) });
  } catch (error) {
    console.error('DELETE /api/admin/students/:id error:', error);
    return res.status(500).json({ message: 'Failed to remove student' });
  }
});

router.get('/teacher-material-users', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = normalizeTeacherMaterialAccessStatus(req.query.status);
    const where = {};

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { package: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.teacherMaterialUser.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    return res.json(users.map(serializeTeacherMaterialUserForAdmin));
  } catch (error) {
    console.error('GET /api/admin/teacher-material-users error:', error);
    return res.status(500).json({ message: 'Failed to load Teacher Materials users' });
  }
});

router.patch('/teacher-material-users/:id/status', adminWriteLimiter, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const status = normalizeTeacherMaterialAccessStatus(req.body.status);
    if (!id) return res.status(400).json({ message: 'Invalid Teacher Materials user ID' });
    if (!status) return res.status(400).json({ message: `status must be one of: ${TEACHER_MATERIAL_ACCESS_STATUSES.join(', ')}` });
    const existingUser = await prisma.teacherMaterialUser.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ message: 'Teacher Materials user not found' });
    const activatedAt = status === 'ACTIVE' ? new Date() : null;
    const packageUpdate = await buildTeacherPackageUpdate(req.body, existingUser);

    const data = {
      ...packageUpdate,
      status,
      isActive: status === 'ACTIVE',
      activatedAt,
      expiresAt: status === 'ACTIVE' ? await getTeacherExpiryDate({ ...existingUser, ...packageUpdate }, activatedAt, req.body.expiresAt) : null,
      proofStatus: status === 'ACTIVE' ? 'CONFIRMED' : normalizeProofStatus(req.body.proofStatus, 'PENDING'),
      confirmedBy: status === 'ACTIVE' ? getAdminConfirmationLabel(req) : null,
      confirmedAt: status === 'ACTIVE' ? new Date() : null,
    };

    if (req.body.paymentReference !== undefined || req.body.transactionId !== undefined) {
      data.paymentReference = String(req.body.paymentReference || req.body.transactionId || '').trim() || null;
    }
    if (req.body.amountPaid !== undefined) {
      const amountPaid = parseOptionalAmount(req.body.amountPaid);
      if (amountPaid !== undefined) data.amountPaid = amountPaid;
    }

    const user = await prisma.teacherMaterialUser.update({ where: { id }, data });
    logAdminAction(req, 'teacher_material_user_status_updated', { teacherMaterialUserId: id, status });
    return res.json({
      message: 'Teacher Materials access status updated',
      user: serializeTeacherMaterialUserForAdmin(user),
    });
  } catch (error) {
    console.error('PATCH /api/admin/teacher-material-users/:id/status error:', error);
    return res.status(500).json({ message: 'Failed to update Teacher Materials access status' });
  }
});

router.patch('/teacher-material-users/:id/activate', adminWriteLimiter, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Invalid Teacher Materials user ID' });
    const existingUser = await prisma.teacherMaterialUser.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ message: 'Teacher Materials user not found' });
    const activatedAt = new Date();
    const packageUpdate = await buildTeacherPackageUpdate(req.body, existingUser);

    const data = {
      ...packageUpdate,
      status: 'ACTIVE',
      isActive: true,
      activatedAt,
      expiresAt: await getTeacherExpiryDate({ ...existingUser, ...packageUpdate }, activatedAt, req.body.expiresAt),
      proofStatus: 'CONFIRMED',
      confirmedBy: getAdminConfirmationLabel(req),
      confirmedAt: new Date(),
    };
    if (req.body.paymentReference !== undefined || req.body.transactionId !== undefined) {
      data.paymentReference = String(req.body.paymentReference || req.body.transactionId || '').trim() || null;
    }
    if (req.body.amountPaid !== undefined) {
      const amountPaid = parseOptionalAmount(req.body.amountPaid);
      if (amountPaid !== undefined) data.amountPaid = amountPaid;
    }

    const user = await prisma.teacherMaterialUser.update({ where: { id }, data });
    logAdminAction(req, 'teacher_material_user_activated', { teacherMaterialUserId: id });
    return res.json({
      message: 'Teacher Materials access activated',
      user: serializeTeacherMaterialUserForAdmin(user),
    });
  } catch (error) {
    console.error('PATCH /api/admin/teacher-material-users/:id/activate error:', error);
    return res.status(500).json({ message: 'Failed to activate Teacher Materials access' });
  }
});

router.patch('/teacher-material-users/:id/deactivate', adminWriteLimiter, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ message: 'Invalid Teacher Materials user ID' });

    const user = await prisma.teacherMaterialUser.update({
      where: { id },
      data: { status: 'INACTIVE', isActive: false, activatedAt: null, expiresAt: null, proofStatus: 'REJECTED', confirmedBy: null, confirmedAt: null },
    });
    logAdminAction(req, 'teacher_material_user_deactivated', { teacherMaterialUserId: id });
    return res.json({
      message: 'Teacher Materials access deactivated',
      user: serializeTeacherMaterialUserForAdmin(user),
    });
  } catch (error) {
    console.error('PATCH /api/admin/teacher-material-users/:id/deactivate error:', error);
    return res.status(500).json({ message: 'Failed to deactivate Teacher Materials access' });
  }
});

router.patch('/teacher-material-users/:id/reset-password', adminWriteLimiter, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const nextPassword = String(req.body.password || req.body.newPassword || '').trim();
    if (!id) return res.status(400).json({ message: 'Invalid Teacher Materials user ID' });
    if (nextPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await prisma.teacherMaterialUser.update({
      where: { id },
      data: { password: hashPassword(nextPassword) },
    });

    logAdminAction(req, 'teacher_material_user_password_reset', { teacherMaterialUserId: id });
    return res.json({
      message: 'Teacher Materials password reset successfully',
      user: serializeTeacherMaterialUserForAdmin(user),
    });
  } catch (error) {
    console.error('PATCH /api/admin/teacher-material-users/:id/reset-password error:', error);
    return res.status(500).json({ message: 'Failed to reset Teacher Materials password' });
  }
});

router.get('/teacher-materials', async (req, res) => {
  try {
    const materialType = req.query.type ? normalizeTeacherMaterialType(req.query.type) : null;
    const status = req.query.status ? normalizeTeacherMaterialContentStatus(req.query.status) : null;
    const qualityStatus = req.query.qualityStatus ? normalizeQualityStatus(req.query.qualityStatus) : null;
    const where = {};
    if (materialType) where.materialType = materialType;
    if (status) where.status = status;
    if (qualityStatus) where.qualityStatus = qualityStatus;

    const materials = await prisma.teacherMaterial.findMany({
      where,
      orderBy: [{ materialType: 'asc' }, { subject: 'asc' }, { grade: 'asc' }, { topic: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json(materials);
  } catch (error) {
    console.error('GET /api/admin/teacher-materials error:', error);
    return res.status(500).json({ message: 'Failed to load Teacher Materials library' });
  }
});

router.post('/teacher-materials', adminWriteLimiter, async (req, res) => {
  try {
    const { payload, errors } = buildTeacherMaterialPayload(req.body);
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    const material = await prisma.teacherMaterial.create({ data: payload });
    logAdminAction(req, 'teacher_material_created', { materialId: material.id, materialType: material.materialType });
    return res.status(201).json({ message: 'Teacher Material created successfully', material });
  } catch (error) {
    console.error('POST /api/admin/teacher-materials error:', error);
    return res.status(500).json({ message: 'Failed to create Teacher Material' });
  }
});

router.post('/teacher-materials/publish-active-existing', adminWriteLimiter, async (req, res) => {
  try {
    const result = await prisma.teacherMaterial.updateMany({
      where: {
        status: 'ACTIVE',
        qualityStatus: { in: ['DRAFT', 'NEEDS_REVIEW', 'APPROVED'] },
      },
      data: { qualityStatus: 'PUBLISHED' },
    });
    logAdminAction(req, 'teacher_materials_bulk_published', { count: result.count });
    return res.json({ message: `${result.count} active teacher material(s) published`, count: result.count });
  } catch (error) {
    console.error('POST /api/admin/teacher-materials/publish-active-existing error:', error);
    return res.status(500).json({ message: 'Failed to publish active Teacher Materials' });
  }
});

router.patch('/teacher-materials/:id', adminWriteLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid Teacher Material ID' });

    const { payload, errors } = buildTeacherMaterialPayload(req.body);
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    const material = await prisma.teacherMaterial.update({ where: { id }, data: payload });
    logAdminAction(req, 'teacher_material_updated', { materialId: id, materialType: material.materialType });
    return res.json({ message: 'Teacher Material updated successfully', material });
  } catch (error) {
    console.error('PATCH /api/admin/teacher-materials/:id error:', error);
    return res.status(500).json({ message: 'Failed to update Teacher Material' });
  }
});

router.delete('/teacher-materials/:id', adminWriteLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid Teacher Material ID' });

    await prisma.teacherMaterial.delete({ where: { id } });
    logAdminAction(req, 'teacher_material_deleted', { materialId: id });
    return res.json({ message: 'Teacher Material deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/admin/teacher-materials/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete Teacher Material' });
  }
});

router.get('/audit-logs', async (req, res) => {
  const limit = Number(req.query.limit) || 100;
  logAdminAction(req, 'audit_log_viewed', { limit });
  return res.json(readAuditLog(limit));
});

router.get('/results', async (_req, res) => {
  try {
    const results = await prisma.quizAttempt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        student: { select: { id: true, name: true, email: true, phoneNumber: true, grade: true, isActive: true, status: true } },
        quiz: { include: { topic: { select: { id: true, title: true } } } },
        mockExam: { select: { id: true, title: true, topic: { select: { id: true, title: true } } } },
      },
    });

    return res.json(results.map((row) => ({
      ...row,
      phone: row.student?.phoneNumber || null,
      title: row.mockExam?.title || row.quizTitle || row.quiz?.title || row.quiz?.topic?.title || 'Quiz',
      topicName: row.mockExam?.topic?.title || row.quiz?.topic?.title || null,
      mockExamId: row.mockExamId || row.mockExam?.id || null,
    })));
  } catch (error) {
    console.error('GET /api/admin/results error:', error);
    return res.status(500).json({ message: 'Failed to fetch results' });
  }
});

router.post('/questions/bulk-preview', adminWriteLimiter, async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ message: 'At least one question is required' });

    const preview = questions.map((q, index) => {
      const { row, errors } = normalizeBulkRow(q);
      return { rowNumber: index + 1, valid: errors.length === 0, errors, normalized: row };
    });

    logAdminAction(req, 'bulk_preview_run', { rows: questions.length });
    return res.json({ count: preview.length, preview });
  } catch (error) {
    console.error('POST /api/admin/questions/bulk-preview error:', error);
    return res.status(500).json({ message: 'Bulk preview failed' });
  }
});

router.post('/questions/bulk-upload', adminWriteLimiter, async (req, res) => {
  try {
    const { topicId, quizId, questions } = req.body;
    const parsedTopicId = Number(topicId);
    const parsedQuizId = quizId !== undefined && quizId !== null && quizId !== '' ? Number(quizId) : null;

    if (Number.isNaN(parsedTopicId)) return res.status(400).json({ message: 'Valid topicId is required' });
    if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ message: 'At least one question is required' });

    const topic = await prisma.topic.findUnique({ where: { id: parsedTopicId } });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    let quiz = null;
    if (parsedQuizId !== null) {
      if (Number.isNaN(parsedQuizId)) return res.status(400).json({ message: 'Invalid quizId' });
      quiz = await prisma.quiz.findUnique({ where: { id: parsedQuizId } });
      if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    } else {
      quiz = await getOrCreateQuiz(parsedTopicId);
    }

    const validationErrors = [];
    const records = [];
    questions.forEach((q, index) => {
      const { row, errors } = normalizeBulkRow(q);
      if (errors.length) {
        validationErrors.push(`Row ${index + 1}: ${errors.join(', ')}`);
        return;
      }
      records.push({ ...row, topicId: parsedTopicId, quizId: quiz?.id || null });
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors: validationErrors });
    }

    const created = await prisma.$transaction(records.map((record) => prisma.question.create({ data: record })));
    logAdminAction(req, 'bulk_upload_completed', { topicId: parsedTopicId, quizId: quiz?.id || null, count: created.length });
    return res.status(201).json({ message: `${created.length} questions uploaded successfully`, count: created.length, received: questions.length, quizId: quiz?.id || null });
  } catch (error) {
    console.error('POST /api/admin/questions/bulk-upload error:', error);
    return res.status(500).json({ message: 'Bulk upload failed', debug: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

module.exports = router;
