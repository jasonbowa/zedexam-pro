
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { logAdminAction } = require('../utils/audit');

const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 40, keyPrefix: 'teachers-write' });

router.get('/', requireAuth, async (_req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: { school: true },
    });
    return res.json(teachers);
  } catch (error) {
    console.error('GET /api/teachers error:', error);
    return res.status(500).json({ message: 'Failed to load teachers' });
  }
});

router.post('/', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const schoolId = req.body.schoolId ? Number(req.body.schoolId) : null;
    const payload = {
      fullName: String(req.body.fullName || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase() || null,
      phoneNumber: String(req.body.phoneNumber || '').trim() || null,
      subject: String(req.body.subject || '').trim() || null,
      schoolId: schoolId || null,
    };
    if (!payload.fullName) return res.status(400).json({ message: 'Teacher full name is required' });

    const teacher = await prisma.teacher.create({ data: payload, include: { school: true } });
    logAdminAction(req, 'teacher_created', { teacherId: teacher.id, fullName: teacher.fullName, schoolId: teacher.schoolId });
    return res.status(201).json(teacher);
  } catch (error) {
    console.error('POST /api/teachers error:', error);
    return res.status(500).json({ message: 'Failed to create teacher' });
  }
});

router.put('/:id', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schoolId = req.body.schoolId ? Number(req.body.schoolId) : null;
    if (!id) return res.status(400).json({ message: 'Invalid teacher id' });

    const payload = {
      fullName: String(req.body.fullName || '').trim(),
      email: String(req.body.email || '').trim().toLowerCase() || null,
      phoneNumber: String(req.body.phoneNumber || '').trim() || null,
      subject: String(req.body.subject || '').trim() || null,
      schoolId: schoolId || null,
    };
    if (!payload.fullName) return res.status(400).json({ message: 'Teacher full name is required' });

    const teacher = await prisma.teacher.update({ where: { id }, data: payload, include: { school: true } });
    logAdminAction(req, 'teacher_updated', { teacherId: teacher.id, schoolId: teacher.schoolId });
    return res.json(teacher);
  } catch (error) {
    console.error('PUT /api/teachers/:id error:', error);
    return res.status(500).json({ message: 'Failed to update teacher' });
  }
});

router.delete('/:id', requireAdmin, writeLimiter, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid teacher id' });

    await prisma.teacher.delete({ where: { id } });
    logAdminAction(req, 'teacher_deleted', { teacherId: id });
    return res.json({ message: 'Teacher removed successfully' });
  } catch (error) {
    console.error('DELETE /api/teachers/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete teacher' });
  }
});

module.exports = router;
