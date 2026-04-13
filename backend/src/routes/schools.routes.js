
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { logAdminAction } = require('../utils/audit');

const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, keyPrefix: 'schools-write' });

router.get('/', requireAuth, async (_req, res) => {
  try {
    const schools = await prisma.school.findMany({
      orderBy: [{ name: 'asc' }],
      include: {
        _count: { select: { students: true, teachers: true, packages: true } },
      },
    });
    return res.json(schools);
  } catch (error) {
    console.error('GET /api/schools error:', error);
    return res.status(500).json({ message: 'Failed to load schools' });
  }
});

router.post('/', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const payload = {
      name: String(req.body.name || '').trim(),
      code: String(req.body.code || '').trim() || null,
      contactName: String(req.body.contactName || '').trim() || null,
      contactPhone: String(req.body.contactPhone || '').trim() || null,
      contactEmail: String(req.body.contactEmail || '').trim().toLowerCase() || null,
      address: String(req.body.address || '').trim() || null,
      status: String(req.body.status || 'active').trim().toLowerCase(),
    };
    if (!payload.name) return res.status(400).json({ message: 'School name is required' });

    const school = await prisma.school.create({ data: payload });
    logAdminAction(req, 'school_created', { schoolId: school.id, schoolName: school.name });
    return res.status(201).json(school);
  } catch (error) {
    console.error('POST /api/schools error:', error);
    return res.status(500).json({ message: 'Failed to create school' });
  }
});

router.put('/:id', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid school id' });

    const payload = {
      name: String(req.body.name || '').trim(),
      code: String(req.body.code || '').trim() || null,
      contactName: String(req.body.contactName || '').trim() || null,
      contactPhone: String(req.body.contactPhone || '').trim() || null,
      contactEmail: String(req.body.contactEmail || '').trim().toLowerCase() || null,
      address: String(req.body.address || '').trim() || null,
      status: String(req.body.status || 'active').trim().toLowerCase(),
    };
    if (!payload.name) return res.status(400).json({ message: 'School name is required' });

    const school = await prisma.school.update({ where: { id }, data: payload });
    logAdminAction(req, 'school_updated', { schoolId: school.id, schoolName: school.name });
    return res.json(school);
  } catch (error) {
    console.error('PUT /api/schools/:id error:', error);
    return res.status(500).json({ message: 'Failed to update school' });
  }
});

router.delete('/:id', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid school id' });

    await prisma.school.delete({ where: { id } });
    logAdminAction(req, 'school_deleted', { schoolId: id });
    return res.json({ message: 'School removed successfully' });
  } catch (error) {
    console.error('DELETE /api/schools/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete school' });
  }
});

module.exports = router;
