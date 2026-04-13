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
const { toPublicAdmin, toPublicStudent } = require('../utils/serializers');
const { logAdminAction, readAuditLog, appendAuditLog } = require('../utils/audit');

const adminLoginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'admin-login' });
const adminWriteLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 40, keyPrefix: 'admin-write' });

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
  } else if (status === 'inactive') {
    where.isActive = false;
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
