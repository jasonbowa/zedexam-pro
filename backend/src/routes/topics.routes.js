const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { ensureStudentCanAccessSubject } = require('../utils/subscriptions');

router.get('/', requireAuth, async (req, res) => {
  try {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const where = subjectId && !Number.isNaN(subjectId) ? { subjectId } : {};

    if (!req.user?.isAdmin && subjectId) {
      const access = await ensureStudentCanAccessSubject(req.currentStudent, subjectId);
      if (!access.allowed) return res.status(access.status || 403).json({ message: access.reason });
    }

    const topics = await prisma.topic.findMany({
      where,
      orderBy: [{ subjectId: 'asc' }, { id: 'asc' }],
      include: {
        subject: { select: { id: true, name: true, grade: true } },
        _count: { select: { quizzes: true, questions: true, mockExams: true } },
      },
    });

    return res.json(topics);
  } catch (error) {
    console.error('GET /api/topics error:', error);
    return res.status(500).json({ message: 'Failed to fetch topics' });
  }
});

router.get('/subject/:subjectId', requireAuth, async (req, res) => {
  try {
    const subjectId = Number(req.params.subjectId);
    if (Number.isNaN(subjectId)) {
      return res.status(400).json({ message: 'Invalid subject ID' });
    }

    if (!req.user?.isAdmin) {
      const access = await ensureStudentCanAccessSubject(req.currentStudent, subjectId);
      if (!access.allowed) return res.status(access.status || 403).json({ message: access.reason });
    }

    const topics = await prisma.topic.findMany({
      where: { subjectId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { quizzes: true, questions: true, mockExams: true } } },
    });

    return res.json(topics);
  } catch (error) {
    console.error('GET /api/topics/subject/:subjectId error:', error);
    return res.status(500).json({ message: 'Failed to fetch subject topics' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid topic ID' });
    }

    const topic = await prisma.topic.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, grade: true } },
        _count: { select: { quizzes: true, questions: true, mockExams: true } },
      },
    });

    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    if (!req.user?.isAdmin) {
      const access = await ensureStudentCanAccessSubject(req.currentStudent, topic.subjectId);
      if (!access.allowed) return res.status(access.status || 403).json({ message: access.reason });
    }

    return res.json(topic);
  } catch (error) {
    console.error('GET /api/topics/:id error:', error);
    return res.status(500).json({ message: 'Failed to fetch topic' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, description, subjectId } = req.body;
    const trimmedTitle = String(title || '').trim();
    const parsedSubjectId = Number(subjectId);

    if (!trimmedTitle || Number.isNaN(parsedSubjectId)) {
      return res.status(400).json({ message: 'Topic title and valid subjectId are required' });
    }

    const subject = await prisma.subject.findUnique({ where: { id: parsedSubjectId } });
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const existing = await prisma.topic.findFirst({ where: { title: trimmedTitle, subjectId: parsedSubjectId } });
    if (existing) {
      return res.status(409).json({ message: 'Topic already exists for this subject' });
    }

    const topic = await prisma.topic.create({
      data: {
        title: trimmedTitle,
        description: description ? String(description).trim() : null,
        subjectId: parsedSubjectId,
      },
    });

    const quiz = await prisma.quiz.create({ data: { title: `${trimmedTitle} Quiz`, topicId: topic.id } });
    return res.status(201).json({ message: 'Topic created successfully', topic, quiz });
  } catch (error) {
    console.error('POST /api/topics error:', error);
    return res.status(500).json({ message: 'Failed to create topic' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid topic ID' });
    }

    const existing = await prisma.topic.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    await prisma.topic.delete({ where: { id } });
    return res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/topics/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete topic' });
  }
});

module.exports = router;
