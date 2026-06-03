const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const env = require('../config/env');
const { requireTeacherMaterials, requireActiveTeacherMaterials } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  normalizeEmail,
  normalizePhoneNumber,
  isValidStudentPhoneNumber,
  buildStudentLoginCandidates,
} = require('../utils/normalizers');
const {
  hashPassword,
  verifyPassword,
  shouldUpgradePasswordHash,
  signToken,
} = require('../utils/security');
const { toPublicTeacherMaterialUser } = require('../utils/serializers');
const { appendAuditLog } = require('../utils/audit');
const { getPaymentInstructions } = require('../utils/payment');
const { resolveTeacherPackage } = require('../utils/accessControl');

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'teacher-materials-login' });
const registerLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: 'teacher-materials-register' });

const MATERIAL_TYPES = {
  notes: 'NOTE',
  guides: 'GUIDE',
  downloads: 'DOWNLOAD',
};

function buildTeacherMaterialsToken(user) {
  return signToken(
    { id: user.id, role: 'teacher_materials', isAdmin: false },
    env.AUTH_SECRET,
    env.TEACHER_MATERIALS_TOKEN_TTL_SECONDS
  );
}

function getAccessSummary(user) {
  const rawStatus = String(user?.status || 'PENDING').trim().toUpperCase();
  const expiredByDate = user?.expiresAt ? new Date(user.expiresAt).getTime() < Date.now() : false;
  const status = expiredByDate ? 'EXPIRED' : rawStatus;
  const isActive = user?.isActive === true && status === 'ACTIVE';

  return {
    status,
    isActive,
    package: user?.package || null,
    activatedAt: user?.activatedAt || null,
    expiresAt: user?.expiresAt || null,
    paymentInstructions: isActive ? null : getPaymentInstructions(),
  };
}

function serializeMaterial(material) {
  return {
    id: material.id,
    title: material.title,
    materialType: material.materialType,
    subject: material.subject,
    grade: material.grade,
    topic: material.topic,
    summary: material.summary,
    learningObjectives: material.learningObjectives,
    keyConcepts: material.keyConcepts,
    suggestedTeachingMethod: material.suggestedTeachingMethod,
    commonLearnerDifficulties: material.commonLearnerDifficulties,
    assessmentQuestions: material.assessmentQuestions,
    markingGuide: material.markingGuide,
    downloadUrl: material.downloadUrl,
    status: material.status,
    qualityStatus: material.qualityStatus || 'DRAFT',
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

async function findTeacherMaterialUserByIdentifier(rawIdentifier) {
  const normalizedEmail = normalizeEmail(rawIdentifier);
  const loginCandidates = buildStudentLoginCandidates(rawIdentifier);

  return prisma.teacherMaterialUser.findFirst({
    where: {
      OR: [
        ...(normalizedEmail && normalizedEmail.includes('@') ? [{ email: normalizedEmail }] : []),
        ...loginCandidates.map((candidate) => ({ phone: candidate })),
      ],
    },
  });
}

router.get('/packages', async (_req, res) => {
  try {
    const packages = await prisma.subscriptionPackage.findMany({
      where: { active: true },
      orderBy: [{ priceZmw: 'asc' }],
      select: { id: true, name: true, description: true, priceZmw: true, durationDays: true },
    });
    return res.json(packages);
  } catch (error) {
    console.error('GET /api/teacher-materials/packages error:', error);
    return res.status(500).json({ message: 'Failed to load Teacher Materials package options' });
  }
});

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, phone, phoneNumber, email, password, packageId, package: selectedPackage, selectedPackage: selectedPackageAlias } = req.body;

    const trimmedName = String(name || '').trim();
    const normalizedPhone = normalizePhoneNumber(phone || phoneNumber);
    const normalizedEmail = normalizeEmail(email);
    const trimmedPassword = String(password || '').trim();
    let packageName = String(selectedPackage || selectedPackageAlias || '').trim() || null;
    let resolvedPackageId = null;

    if (!trimmedName || !normalizedPhone || !trimmedPassword) {
      return res.status(400).json({ message: 'Name, phone number, and password are required' });
    }

    if (!isValidStudentPhoneNumber(normalizedPhone)) {
      return res.status(400).json({ message: 'Please enter a valid phone number, for example 0977123456' });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const parsedPackageId = Number(packageId);
    if (parsedPackageId && !Number.isNaN(parsedPackageId)) {
      const plan = await prisma.subscriptionPackage.findFirst({ where: { id: parsedPackageId, active: true } });
      if (!plan) return res.status(400).json({ message: 'Selected Teacher Materials package was not found' });
      packageName = plan.name;
      resolvedPackageId = plan.id;
    } else if (packageName) {
      const plan = await prisma.subscriptionPackage.findFirst({ where: { name: packageName, active: true } });
      if (plan) resolvedPackageId = plan.id;
    }

    const existing = await prisma.teacherMaterialUser.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ message: 'A Teacher Materials account with this phone number or email already exists' });
    }

    const user = await prisma.teacherMaterialUser.create({
      data: {
        name: trimmedName,
        phone: normalizedPhone,
        email: normalizedEmail,
        password: hashPassword(trimmedPassword),
        packageId: resolvedPackageId,
        package: packageName,
        status: 'PENDING',
        isActive: false,
      },
    });

    appendAuditLog('teacher_materials_registered', { actorId: user.id, phone: normalizedPhone, ip: req.ip });
    return res.status(201).json({
      message: 'Teacher Materials account created. Complete payment to activate access.',
      token: buildTeacherMaterialsToken(user),
      user: toPublicTeacherMaterialUser(user),
      access: getAccessSummary(user),
    });
  } catch (error) {
    console.error('POST /api/teacher-materials/register error:', error);
    return res.status(500).json({ message: 'Failed to register Teacher Materials account' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { identifier, phoneOrEmail, phoneNumber, phone, email, password } = req.body;
    const rawIdentifier = String(identifier || phoneOrEmail || phoneNumber || phone || email || '').trim();
    const providedPassword = String(password || '').trim();

    if (!rawIdentifier || !providedPassword) {
      return res.status(400).json({ message: 'Phone/email and password are required' });
    }

    const user = await findTeacherMaterialUserByIdentifier(rawIdentifier);
    if (!user || !verifyPassword(providedPassword, user.password)) {
      appendAuditLog('teacher_materials_login_failed', { identifier: rawIdentifier.slice(0, 80), ip: req.ip });
      return res.status(401).json({ message: 'Invalid Teacher Materials credentials' });
    }

    const updates = { lastLoginAt: new Date() };
    if (shouldUpgradePasswordHash(user.password)) updates.password = hashPassword(providedPassword);

    const safeUser = await prisma.teacherMaterialUser.update({ where: { id: user.id }, data: updates });

    appendAuditLog('teacher_materials_login_success', { actorId: safeUser.id, ip: req.ip });
    return res.json({
      message: 'Teacher Materials login successful',
      token: buildTeacherMaterialsToken(safeUser),
      user: toPublicTeacherMaterialUser(safeUser),
      access: getAccessSummary(safeUser),
    });
  } catch (error) {
    console.error('POST /api/teacher-materials/login error:', error);
    return res.status(500).json({ message: 'Failed to login to Teacher Materials' });
  }
});

router.post('/change-password', requireTeacherMaterials, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '').trim();
    const nextPassword = String(req.body.newPassword || req.body.password || '').trim();
    const user = req.currentTeacherMaterialUser;

    if (!currentPassword || !nextPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (nextPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    if (!verifyPassword(currentPassword, user.password)) {
      appendAuditLog('teacher_materials_password_change_failed', { actorId: user.id, ip: req.ip });
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    await prisma.teacherMaterialUser.update({
      where: { id: user.id },
      data: { password: hashPassword(nextPassword) },
    });

    appendAuditLog('teacher_materials_password_changed', { actorId: user.id, ip: req.ip });
    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('POST /api/teacher-materials/change-password error:', error);
    return res.status(500).json({ message: 'Failed to change password' });
  }
});

router.get('/me', requireTeacherMaterials, async (req, res) => {
  const user = req.currentTeacherMaterialUser;
  if (!user.packageId && user.package) {
    const plan = await resolveTeacherPackage(user);
    if (plan) {
      const updated = await prisma.teacherMaterialUser.update({ where: { id: user.id }, data: { packageId: plan.id } });
      return res.json({
        user: toPublicTeacherMaterialUser(updated),
        access: getAccessSummary(updated),
      });
    }
  }
  return res.json({
    user: toPublicTeacherMaterialUser(user),
    access: getAccessSummary(user),
  });
});

router.get('/materials', requireActiveTeacherMaterials, async (req, res) => {
  try {
    const materials = await prisma.teacherMaterial.findMany({
      where: { status: 'ACTIVE', qualityStatus: 'PUBLISHED' },
      orderBy: [{ subject: 'asc' }, { grade: 'asc' }, { topic: 'asc' }, { createdAt: 'desc' }],
    });
    return res.json(materials.map(serializeMaterial));
  } catch (error) {
    console.error('GET /api/teacher-materials/materials error:', error);
    return res.status(500).json({ message: 'Failed to load Teacher Materials' });
  }
});

router.get('/:collection(notes|guides|downloads)', requireActiveTeacherMaterials, async (req, res) => {
  try {
    const materialType = MATERIAL_TYPES[req.params.collection];
    const materials = await prisma.teacherMaterial.findMany({
      where: { status: 'ACTIVE', qualityStatus: 'PUBLISHED', materialType },
      orderBy: [{ subject: 'asc' }, { grade: 'asc' }, { topic: 'asc' }, { createdAt: 'desc' }],
    });
    return res.json(materials.map(serializeMaterial));
  } catch (error) {
    console.error(`GET /api/teacher-materials/${req.params.collection} error:`, error);
    return res.status(500).json({ message: 'Failed to load Teacher Materials' });
  }
});

module.exports = router;
