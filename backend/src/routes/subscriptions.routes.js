const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { logAdminAction } = require('../utils/audit');
const { getStudentPlanContext } = require('../utils/subscriptions');

const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 50, keyPrefix: 'subscription-write' });

router.get('/packages', requireAuth, async (_req, res) => {
  try {
    const packages = await prisma.subscriptionPackage.findMany({ orderBy: [{ priceZmw: 'asc' }] });
    return res.json(packages);
  } catch (error) {
    console.error('GET /api/subscriptions/packages error:', error);
    return res.status(500).json({ message: 'Failed to load subscription packages' });
  }
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
      return res.json({ subscription: null, capabilities: null, note: 'Admins do not have learner subscription plans' });
    }

    const { subscription, capabilities } = await getStudentPlanContext(req.user.id);
    return res.json({ subscription, capabilities });
  } catch (error) {
    console.error('GET /api/subscriptions/my-plan error:', error);
    return res.status(500).json({ message: 'Failed to load current plan' });
  }
});

router.get('/admin/assignments', requireAdmin, async (_req, res) => {
  try {
    const subscriptions = await prisma.studentSubscription.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: { student: true, package: true, school: true },
    });
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
    const status = String(req.body.status || 'ACTIVE').trim().toUpperCase();
    const activationCode = String(req.body.activationCode || '').trim() || null;
    const notes = String(req.body.notes || '').trim() || null;
    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();

    if (!studentId || !packageId) {
      return res.status(400).json({ message: 'studentId and packageId are required' });
    }

    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
    if (!pkg) return res.status(404).json({ message: 'Package not found' });

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Number(pkg.durationDays || 30));

    if (status === 'ACTIVE') {
      await prisma.studentSubscription.updateMany({
        where: { studentId, status: 'ACTIVE' },
        data: { status: 'EXPIRED', endDate: new Date() },
      });
    }

    const created = await prisma.studentSubscription.create({
      data: {
        studentId,
        packageId,
        schoolId: schoolId || null,
        sponsorName,
        status,
        activationCode,
        notes,
        startDate,
        endDate,
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

module.exports = router;
