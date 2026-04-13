const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const env = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  normalizeGrade,
  listGradeValues,
  normalizeEmail,
  normalizePhoneNumber,
  isValidStudentPhoneNumber,
  buildStudentLoginCandidates,
} = require('../utils/normalizers');
const { toPublicStudent, toPublicAdmin } = require('../utils/serializers');
const {
  hashPassword,
  verifyPassword,
  shouldUpgradePasswordHash,
  signToken,
} = require('../utils/security');
const { appendAuditLog } = require('../utils/audit');

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'auth-login' });
const registerLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'auth-register' });

function buildStudentToken(student) {
  return signToken(
    { id: student.id, role: 'student', isAdmin: false },
    env.AUTH_SECRET,
    env.TOKEN_TTL_SECONDS
  );
}

function buildAdminToken(adminId = 1) {
  return signToken(
    { id: adminId, role: 'admin', isAdmin: true },
    env.AUTH_SECRET,
    env.TOKEN_TTL_SECONDS
  );
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

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { identifier, email, phoneOrEmail, phoneNumber, phone, password } = req.body;

    const rawIdentifier = String(identifier || email || phoneOrEmail || phoneNumber || phone || '').trim();
    const providedPassword = String(password || '').trim();

    if (!rawIdentifier || !providedPassword) {
      return res.status(400).json({ message: 'Email/phone and password are required' });
    }

    const normalizedEmail = normalizeEmail(rawIdentifier);
    const admin = normalizedEmail ? await prisma.admin.findUnique({ where: { email: normalizedEmail } }) : null;

    if (admin && verifyPassword(providedPassword, admin.password)) {
      if (shouldUpgradePasswordHash(admin.password)) {
        await prisma.admin.update({ where: { id: admin.id }, data: { password: hashPassword(providedPassword) } });
      }

      appendAuditLog('admin_login_success', { actorId: admin.id, identifier: normalizedEmail, ip: req.ip });
      return res.json({
        message: 'Admin login successful',
        token: buildAdminToken(admin.id),
        user: { ...toPublicAdmin(admin), role: 'admin', isAdmin: true },
      });
    }

    if (normalizedEmail === env.ADMIN_EMAIL && verifyPassword(providedPassword, env.ADMIN_PASSWORD)) {
      appendAuditLog('admin_env_login_success', { actorId: 1, identifier: normalizedEmail, ip: req.ip });
      return res.json({
        message: 'Admin login successful',
        token: buildAdminToken(1),
        user: { id: 1, name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, role: 'admin', isAdmin: true },
      });
    }

    const loginCandidates = buildStudentLoginCandidates(rawIdentifier);
    const student = await prisma.student.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(normalizedEmail && normalizedEmail.includes('@') ? [{ email: normalizedEmail }] : []),
          ...loginCandidates.map((candidate) => ({ phoneNumber: candidate })),
        ],
      },
    });

    if (!student || !verifyPassword(providedPassword, student.password)) {
      appendAuditLog('login_failed', { identifier: rawIdentifier.slice(0, 80), ip: req.ip });
      return res.status(401).json({ message: 'Invalid email/phone or password' });
    }

    if (student.isActive === false || String(student.status || '').toLowerCase() === 'inactive') {
      appendAuditLog('student_login_blocked_inactive', { actorId: student.id, identifier: rawIdentifier.slice(0, 80), ip: req.ip });
      return res.status(403).json({ message: 'This student account is deactivated. Please contact the administrator.' });
    }

    const normalizedPhone = normalizePhoneNumber(student.phoneNumber);
    const studentUpdates = { lastLoginAt: new Date() };
    if (shouldUpgradePasswordHash(student.password)) studentUpdates.password = hashPassword(providedPassword);
    if (normalizedPhone && normalizedPhone !== student.phoneNumber) studentUpdates.phoneNumber = normalizedPhone;
    if (!student.status || String(student.status).toLowerCase() === 'pending') studentUpdates.status = 'active';

    const safeStudent = await prisma.student.update({ where: { id: student.id }, data: studentUpdates });

    appendAuditLog('student_login_success', { actorId: safeStudent.id, identifier: rawIdentifier.slice(0, 80), ip: req.ip });
    return res.json({
      message: 'Login successful',
      token: buildStudentToken(safeStudent),
      user: { ...toPublicStudent(safeStudent), role: 'student', isAdmin: false },
    });
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return res.status(500).json({ message: 'Failed to login' });
  }
});

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, phoneNumber, phone, password, grade, school, schoolId } = req.body;

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

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (normalizedEmail && normalizedEmail === env.ADMIN_EMAIL) {
      return res.status(400).json({ message: 'This email is reserved' });
    }

    const schoolResolution = await resolveSchool(schoolId);
    if (schoolResolution.error) {
      return res.status(400).json({ message: schoolResolution.error });
    }

    const existingStudent = await prisma.student.findFirst({
      where: {
        OR: [
          { phoneNumber: normalizedPhone },
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
    });

    if (existingStudent && !existingStudent.deletedAt) {
      return res.status(409).json({ message: 'A student with this phone number or email already exists' });
    }

    if (existingStudent?.deletedAt) {
      return res.status(409).json({ message: 'This student record already exists in the system and was previously removed. Restore it from admin instead of registering again.' });
    }

    const student = await prisma.student.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        password: hashPassword(trimmedPassword),
        grade: normalizedGrade,
        school: schoolResolution.schoolName || trimmedSchool,
        schoolId: schoolResolution.schoolId,
        status: 'active',
        isActive: true,
      },
    });

    appendAuditLog('student_registered', { actorId: student.id, ip: req.ip, grade: normalizedGrade });
    return res.status(201).json({
      message: 'Student registered successfully',
      token: buildStudentToken(student),
      user: { ...toPublicStudent(student), role: 'student', isAdmin: false },
    });
  } catch (error) {
    console.error('POST /api/auth/register error:', error);
    return res.status(500).json({ message: 'Failed to register student' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.user?.isAdmin) {
      const admin = await prisma.admin.findFirst({ where: { OR: [{ id: req.user.id }, { email: env.ADMIN_EMAIL }] } });
      return res.json({
        user: admin
          ? { ...toPublicAdmin(admin), role: 'admin', isAdmin: true }
          : { id: 1, name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, role: 'admin', isAdmin: true },
      });
    }

    const student = req.currentStudent || await prisma.student.findUnique({ where: { id: req.user.id } });
    if (!student || student.deletedAt) return res.status(404).json({ message: 'User not found' });

    return res.json({ user: { ...toPublicStudent(student), role: 'student', isAdmin: false } });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return res.status(500).json({ message: 'Failed to load current user' });
  }
});

module.exports = router;
