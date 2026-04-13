const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { normalizeGrade, listGradeValues } = require('../utils/normalizers');
const { listAccessibleSubjectsForStudent, ensureStudentCanAccessSubject } = require('../utils/subscriptions');

router.get('/', requireAuth, async (req, res) => {
  try {
    const grade = normalizeGrade(req.query.grade);

    if (!req.user?.isAdmin) {
      const currentStudent = req.currentStudent;
      const { capabilities, subjects } = await listAccessibleSubjectsForStudent(currentStudent);
      const filtered = grade ? subjects.filter((subject) => subject.grade === grade) : subjects;
      const subjectIds = filtered.map((subject) => subject.id);
      const hydrated = subjectIds.length
        ? await prisma.subject.findMany({
            where: { id: { in: subjectIds } },
            orderBy: [{ grade: 'asc' }, { id: 'desc' }],
            include: { _count: { select: { topics: true, mockExams: true } } },
          })
        : [];

      return res.json(hydrated.map((subject) => ({ ...subject, accessPlan: capabilities.planName })));
    }

    const where = grade ? { grade } : {};
    const subjects = await prisma.subject.findMany({
      where,
      orderBy: [{ grade: 'asc' }, { id: 'desc' }],
      include: { _count: { select: { topics: true, mockExams: true } } },
    });

    return res.json(subjects);
  } catch (error) {
    console.error('GET /api/subjects error:', error);
    return res.status(500).json({ message: 'Failed to fetch subjects' });
  }
});

router.get('/:id/topics', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid subject ID' });
    }

    if (!req.user?.isAdmin) {
      const access = await ensureStudentCanAccessSubject(req.currentStudent, id);
      if (!access.allowed) return res.status(access.status || 403).json({ message: access.reason });
    }

    const topics = await prisma.topic.findMany({
      where: { subjectId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { questions: true, quizzes: true, mockExams: true } } },
    });

    return res.json(topics);
  } catch (error) {
    console.error('GET /api/subjects/:id/topics error:', error);
    return res.status(500).json({ message: 'Failed to fetch subject topics' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid subject ID' });
    }

    if (!req.user?.isAdmin) {
      const access = await ensureStudentCanAccessSubject(req.currentStudent, id);
      if (!access.allowed) return res.status(access.status || 403).json({ message: access.reason });
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: { _count: { select: { topics: true, mockExams: true } } },
    });

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    return res.json(subject);
  } catch (error) {
    console.error('GET /api/subjects/:id error:', error);
    return res.status(500).json({ message: 'Failed to fetch subject' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, grade, description } = req.body;
    const trimmedName = String(name || '').trim();
    const normalizedGrade = normalizeGrade(grade);

    if (!trimmedName || !normalizedGrade) {
      return res.status(400).json({
        message: `Subject name and a valid grade are required. Allowed grades: ${listGradeValues().join(', ')}`,
      });
    }

    const existing = await prisma.subject.findUnique({
      where: { name_grade: { name: trimmedName, grade: normalizedGrade } },
    });

    if (existing) {
      return res.status(409).json({ message: 'Subject already exists for this grade' });
    }

    const subject = await prisma.subject.create({
      data: {
        name: trimmedName,
        description: description ? String(description).trim() : null,
        grade: normalizedGrade,
      },
    });

    return res.status(201).json({ message: 'Subject created successfully', subject });
  } catch (error) {
    console.error('POST /api/subjects error:', error);
    return res.status(500).json({ message: 'Failed to create subject' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, grade, description } = req.body;
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid subject ID' });

    const trimmedName = String(name || '').trim();
    const normalizedGrade = normalizeGrade(grade);
    if (!trimmedName || !normalizedGrade) {
      return res.status(400).json({
        message: `Subject name and a valid grade are required. Allowed grades: ${listGradeValues().join(', ')}`,
      });
    }

    const subject = await prisma.subject.update({
      where: { id },
      data: {
        name: trimmedName,
        description: description ? String(description).trim() : null,
        grade: normalizedGrade,
      },
    });

    return res.json({ message: 'Subject updated successfully', subject });
  } catch (error) {
    console.error('PUT /api/subjects/:id error:', error);
    return res.status(500).json({ message: 'Failed to update subject' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid subject ID' });

    const existing = await prisma.subject.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Subject not found' });

    await prisma.subject.delete({ where: { id } });
    return res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/subjects/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete subject' });
  }
});

module.exports = router;
