
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { logAdminAction } = require('../utils/audit');
const { getPaymentInstructions } = require('../utils/payment');
const { buildStudentAccessPayload } = require('../utils/accessControl');
const { ensureStudentSubscriptionSchema } = require('../utils/studentSubscriptions');
const {
  getStudentPackageWhere,
  getTeacherPackageWhere,
  isTeacherMaterialsPackage,
} = require('../utils/packageAudience');

const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 50, keyPrefix: 'subscription-write' });
const SUBSCRIPTION_STATUSES = ['ACTIVE', 'PENDING', 'EXPIRED', 'INACTIVE', 'CANCELLED'];
const PROOF_STATUSES = ['PENDING', 'SENT', 'CONFIRMED', 'REJECTED'];

function normalizeStatus(value, fallback = 'ACTIVE') {
  const status = String(value || fallback).trim().toUpperCase();
  return SUBSCRIPTION_STATUSES.includes(status) ? status : null;
}

function normalizeProofStatus(value, fallback = 'PENDING') {
  const status = String(value || fallback).trim().toUpperCase();
  return PROOF_STATUSES.includes(status) ? status : fallback;
}

function parseOptionalAmount(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function buildPaymentUpdate(req, proofStatus = 'PENDING') {
  const data = { proofStatus: normalizeProofStatus(req.body.proofStatus, proofStatus) };
  const paymentReference = String(req.body.paymentReference || req.body.transactionId || '').trim();
  const amountPaid = parseOptionalAmount(req.body.amountPaid);

  if (paymentReference) data.paymentReference = paymentReference;
  if (amountPaid !== undefined) data.amountPaid = amountPaid;
  if (req.body.notes !== undefined) data.notes = String(req.body.notes || '').trim() || null;

  return data;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function getSubscriptionColumns() {
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

async function findStudentSubscriptionsCompat({ whereSql = '' } = {}) {
  const columns = await getSubscriptionColumns();
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
    status: row.status,
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

function getAdminConfirmationLabel(req) {
  return req.user?.email || req.user?.id ? `admin:${req.user.email || req.user.id}` : 'admin';
}

function getPackageEndDate(startDate, pkg) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(pkg?.durationDays || 30));
  return endDate;
}

router.get('/public-packages', async (_req, res) => {
  try {
    const packages = await prisma.subscriptionPackage.findMany({
      where: getStudentPackageWhere({ active: true }),
      orderBy: [{ priceZmw: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        durationDays: true,
        priceZmw: true,
        maxSubjects: true,
        maxMockExams: true,
        includesReports: true,
        includesCertificates: true,
      },
    });
    return res.json(packages);
  } catch (error) {
    console.error('GET /api/subscriptions/public-packages error:', error);
    return res.status(500).json({ message: 'Failed to load public subscription packages' });
  }
});

router.get('/packages', requireAuth, async (req, res) => {
  try {
    const where = req.user?.isAdmin
      ? {}
      : req.user?.role === 'teacher_materials'
        ? getTeacherPackageWhere({ active: true })
        : getStudentPackageWhere({ active: true });
    const packages = await prisma.subscriptionPackage.findMany({
      where,
      orderBy: [{ priceZmw: 'asc' }],
    });
    return res.json(packages);
  } catch (error) {
    console.error('GET /api/subscriptions/packages error:', error);
    return res.status(500).json({ message: 'Failed to load subscription packages' });
  }
});

router.get('/payment-instructions', requireAuth, (_req, res) => {
  return res.json({ paymentInstructions: getPaymentInstructions() });
});

router.post('/packages', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const payload = {
      name: String(req.body.name || '').trim(),
      description: String(req.body.description || '').trim() || null,
      durationDays: Number(req.body.durationDays) || 30,
      priceZmw: Number(req.body.priceZmw || 0),
      maxSubjects: req.body.maxSubjects ? Number(req.body.maxSubjects) : null,
      maxMockExams: req.body.maxMockExams ? Number(req.body.maxMockExams) : null,
      includesReports: req.body.includesReports === true || String(req.body.includesReports).toLowerCase() === 'true',
      includesCertificates: req.body.includesCertificates !== false && String(req.body.includesCertificates).toLowerCase() !== 'false',
      active: req.body.active !== false && String(req.body.active).toLowerCase() !== 'false',
    };
    if (!payload.name || payload.priceZmw < 0 || payload.durationDays < 1) {
      return res.status(400).json({ message: 'Valid package name, price, and duration are required' });
    }

    const created = await prisma.subscriptionPackage.create({ data: payload });
    logAdminAction(req, 'subscription_package_created', { packageId: created.id, name: created.name });
    return res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/subscriptions/packages error:', error);
    return res.status(500).json({ message: 'Failed to create package' });
  }
});

router.put('/packages/:id', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid package id' });

    const payload = {
      name: String(req.body.name || '').trim(),
      description: String(req.body.description || '').trim() || null,
      durationDays: Number(req.body.durationDays) || 30,
      priceZmw: Number(req.body.priceZmw || 0),
      maxSubjects: req.body.maxSubjects ? Number(req.body.maxSubjects) : null,
      maxMockExams: req.body.maxMockExams ? Number(req.body.maxMockExams) : null,
      includesReports: req.body.includesReports === true || String(req.body.includesReports).toLowerCase() === 'true',
      includesCertificates: req.body.includesCertificates !== false && String(req.body.includesCertificates).toLowerCase() !== 'false',
      active: req.body.active !== false && String(req.body.active).toLowerCase() !== 'false',
    };
    if (!payload.name || payload.priceZmw < 0 || payload.durationDays < 1) {
      return res.status(400).json({ message: 'Valid package name, price, and duration are required' });
    }

    const updated = await prisma.subscriptionPackage.update({ where: { id }, data: payload });
    logAdminAction(req, 'subscription_package_updated', { packageId: updated.id, name: updated.name });
    return res.json(updated);
  } catch (error) {
    console.error('PUT /api/subscriptions/packages/:id error:', error);
    return res.status(500).json({ message: 'Failed to update package' });
  }
});

router.delete('/packages/:id', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid package id' });
    await prisma.subscriptionPackage.delete({ where: { id } });
    logAdminAction(req, 'subscription_package_deleted', { packageId: id });
    return res.json({ message: 'Package removed successfully' });
  } catch (error) {
    console.error('DELETE /api/subscriptions/packages/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete package' });
  }
});

router.get('/my-plan', requireAuth, async (req, res) => {
  try {
    if (req.user?.isAdmin) {
      return res.json({ subscription: null, note: 'Admins do not have learner subscription plans' });
    }

    await ensureStudentSubscriptionSchema();
    const subscription = await prisma.studentSubscription.findFirst({
      where: { studentId: req.user.id },
      orderBy: [{ createdAt: 'desc' }],
      include: { package: true, school: true },
    });
    if (subscription?.status === 'ACTIVE' && subscription.endDate && new Date(subscription.endDate).getTime() < Date.now()) {
      subscription.status = 'EXPIRED';
      await prisma.studentSubscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED' } }).catch(() => null);
    }
    return res.json({ subscription, access: buildStudentAccessPayload(subscription), paymentInstructions: getPaymentInstructions() });
  } catch (error) {
    console.error('GET /api/subscriptions/my-plan error:', error);
    return res.status(500).json({ message: 'Failed to load current plan' });
  }
});

router.get('/admin/assignments', requireAdmin, async (_req, res) => {
  try {
    const subscriptions = await findStudentSubscriptionsCompat();
    return res.json(subscriptions);
  } catch (error) {
    console.error('GET /api/subscriptions/admin/assignments error:', error);
    return res.status(500).json({ message: 'Failed to load subscription assignments' });
  }
});

router.post('/assign', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const studentId = Number(req.body.studentId);
    const packageId = Number(req.body.packageId);
    const schoolId = req.body.schoolId ? Number(req.body.schoolId) : null;
    const sponsorName = String(req.body.sponsorName || '').trim() || null;
    const status = normalizeStatus(req.body.status, 'ACTIVE');
    const activationCode = String(req.body.activationCode || '').trim() || null;
    const notes = String(req.body.notes || '').trim() || null;
    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
    const paymentReference = String(req.body.paymentReference || req.body.transactionId || '').trim() || null;
    const amountPaid = parseOptionalAmount(req.body.amountPaid);
    const proofStatus = normalizeProofStatus(req.body.proofStatus, status === 'ACTIVE' ? 'CONFIRMED' : 'PENDING');

    if (!studentId || !packageId) {
      return res.status(400).json({ message: 'studentId and packageId are required' });
    }

    if (!status) {
      return res.status(400).json({ message: `status must be one of: ${SUBSCRIPTION_STATUSES.join(', ')}` });
    }

    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    if (isTeacherMaterialsPackage(pkg)) {
      return res.status(400).json({ message: 'Teacher Materials packages cannot be assigned to student accounts' });
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Number(pkg.durationDays || 30));

    const created = await prisma.studentSubscription.create({
      data: {
        studentId,
        packageId,
        schoolId: schoolId || null,
        sponsorName,
        status,
        activationCode,
        paymentReference,
        amountPaid,
        proofStatus,
        confirmedBy: status === 'ACTIVE' ? getAdminConfirmationLabel(req) : null,
        confirmedAt: status === 'ACTIVE' ? new Date() : null,
        notes,
        startDate: status === 'ACTIVE' ? startDate : null,
        endDate: status === 'ACTIVE' ? endDate : null,
      },
      include: { student: true, package: true, school: true },
    });

    logAdminAction(req, 'subscription_assigned', { subscriptionId: created.id, studentId, packageId, status });
    return res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/subscriptions/assign error:', error);
    return res.status(500).json({ message: 'Failed to assign subscription' });
  }
});

router.patch('/admin/assignments/:id/activate', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid subscription id' });

    const existing = await prisma.studentSubscription.findUnique({ where: { id }, include: { package: true } });
    if (!existing) return res.status(404).json({ message: 'Subscription not found' });

    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
    const data = {
      ...buildPaymentUpdate(req, 'CONFIRMED'),
      status: 'ACTIVE',
      startDate,
      endDate: getPackageEndDate(startDate, existing.package),
      confirmedBy: getAdminConfirmationLabel(req),
      confirmedAt: new Date(),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const subscription = await tx.studentSubscription.update({
        where: { id },
        data,
        include: { student: true, package: true, school: true },
      });

      const student = await tx.student.update({
        where: { id: subscription.studentId },
        data: { isActive: true, status: 'active', deactivatedAt: null },
      });

      return { ...subscription, student };
    });
    logAdminAction(req, 'subscription_payment_confirmed', { subscriptionId: id, studentId: updated.studentId, packageId: updated.packageId });
    return res.json({ message: 'Student package activated after payment confirmation', subscription: updated });
  } catch (error) {
    console.error('PATCH /api/subscriptions/admin/assignments/:id/activate error:', error);
    return res.status(500).json({ message: 'Failed to activate subscription' });
  }
});

router.patch('/admin/assignments/:id/deactivate', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid subscription id' });

    const updated = await prisma.$transaction(async (tx) => {
      const subscription = await tx.studentSubscription.update({
        where: { id },
        data: {
          ...buildPaymentUpdate(req, 'REJECTED'),
          status: 'INACTIVE',
          startDate: null,
          endDate: null,
          confirmedBy: null,
          confirmedAt: null,
        },
        include: { student: true, package: true, school: true },
      });

      const activeCount = await tx.studentSubscription.count({
        where: { studentId: subscription.studentId, status: 'ACTIVE', id: { not: id } },
      });
      if (activeCount === 0) {
        const student = await tx.student.update({
          where: { id: subscription.studentId },
          data: { isActive: false, status: 'suspended', deactivatedAt: new Date() },
        });
        return { ...subscription, student };
      }

      return subscription;
    });
    logAdminAction(req, 'subscription_deactivated', { subscriptionId: id, studentId: updated.studentId, packageId: updated.packageId });
    return res.json({ message: 'Student package deactivated', subscription: updated });
  } catch (error) {
    console.error('PATCH /api/subscriptions/admin/assignments/:id/deactivate error:', error);
    return res.status(500).json({ message: 'Failed to deactivate subscription' });
  }
});

module.exports = router;
