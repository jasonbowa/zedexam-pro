const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { listAccessibleMockExamsForStudent, ensureStudentCanAccessMockExam, ensureStudentCanAccessSubject } = require('../utils/subscriptions');

function sanitizeQuestionForAttempt(question) {
  return {
    id: question.id,
    topicId: question.topicId,
    quizId: question.quizId,
    questionType: question.questionType,
    question: question.question,
    passage: question.passage,
    imageUrl: question.imageUrl,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    marks: question.marks,
    difficulty: question.difficulty,
    year: question.year,
    paper: question.paper,
    section: question.section,
  };
}

function flattenQuestionLink(link) {
  const question = link?.question || link;
  return { ...sanitizeQuestionForAttempt(question), linkId: link?.id || null };
}

function decorateMockExam(exam) {
  const flattenedQuestions = Array.isArray(exam.questions) ? exam.questions.map(flattenQuestionLink) : [];
  return {
    ...exam,
    duration: exam.durationMinutes,
    totalQuestions: flattenedQuestions.length,
    questionsCount: flattenedQuestions.length,
    totalMarks: flattenedQuestions.reduce((sum, item) => sum + (item?.marks || 1), 0),
    questions: flattenedQuestions,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const include = {
      subject: { select: { id: true, name: true, grade: true } },
      topic: { select: { id: true, title: true } },
      questions: { include: { question: true } },
    };

    if (!req.user?.isAdmin) {
      const { mockExams, capabilities } = await listAccessibleMockExamsForStudent(req.currentStudent, { include });
      return res.json(mockExams.map((exam) => ({ ...decorateMockExam(exam), accessPlan: capabilities.planName })));
    }

    const mockExams = await prisma.mockExam.findMany({
      orderBy: { createdAt: 'desc' },
      include,
    });

    return res.json(mockExams.map(decorateMockExam));
  } catch (error) {
    console.error('GET /api/mock-exams error:', error);
    return res.status(500).json({ message: 'Failed to fetch mock exams' });
  }
});

router.get('/topic/:topicId', requireAuth, async (req, res) => {
  try {
    const topicId = Number(req.params.topicId);
    if (Number.isNaN(topicId)) {
      return res.status(400).json({ message: 'Invalid topic ID' });
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { subject: true } });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    if (!req.user?.isAdmin) {
      const subjectAccess = await ensureStudentCanAccessSubject(req.currentStudent, topic.subjectId);
      if (!subjectAccess.allowed) return res.status(subjectAccess.status || 403).json({ message: subjectAccess.reason });

      const { mockExams } = await listAccessibleMockExamsForStudent(req.currentStudent, {
        where: { topicId },
        include: {
          subject: { select: { id: true, name: true, grade: true } },
          topic: { select: { id: true, title: true } },
          questions: { include: { question: true } },
        },
      });
      return res.json(mockExams.map(decorateMockExam));
    }

    const mockExams = await prisma.mockExam.findMany({
      where: { topicId },
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, name: true, grade: true } },
        topic: { select: { id: true, title: true } },
        questions: { include: { question: true } },
      },
    });

    return res.json(mockExams.map(decorateMockExam));
  } catch (error) {
    console.error('GET /api/mock-exams/topic/:topicId error:', error);
    return res.status(500).json({ message: 'Failed to fetch mock exams' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid mock exam ID' });
    }

    if (!req.user?.isAdmin) {
      const access = await ensureStudentCanAccessMockExam(req.currentStudent, id);
      if (!access.allowed) return res.status(access.status || 403).json({ message: access.reason });
    }

    const mockExam = await prisma.mockExam.findUnique({
      where: { id },
      include: {
        subject: true,
        topic: true,
        questions: { include: { question: true }, orderBy: { id: 'asc' } },
      },
    });

    if (!mockExam) {
      return res.status(404).json({ message: 'Mock exam not found' });
    }

    return res.json(decorateMockExam(mockExam));
  } catch (error) {
    console.error('GET /api/mock-exams/:id error:', error);
    return res.status(500).json({ message: 'Failed to fetch mock exam' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, instructions, durationMinutes, subjectId, topicId, questionIds } = req.body;
    const parsedSubjectId = Number(subjectId);
    const parsedTopicId = Number(topicId);
    const parsedDuration = Number(durationMinutes);

    if (!String(title || '').trim()) {
      return res.status(400).json({ message: 'Mock exam title is required' });
    }
    if (Number.isNaN(parsedSubjectId) || Number.isNaN(parsedTopicId)) {
      return res.status(400).json({ message: 'Valid subjectId and topicId are required' });
    }
    if (Number.isNaN(parsedDuration) || parsedDuration < 1) {
      return res.status(400).json({ message: 'Duration must be a valid number greater than 0' });
    }
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ message: 'At least one question must be selected' });
    }

    const normalizedQuestionIds = [...new Set(questionIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];
    if (normalizedQuestionIds.length === 0) {
      return res.status(400).json({ message: 'No valid questionIds provided' });
    }

    const [subject, topic, existingQuestions] = await Promise.all([
      prisma.subject.findUnique({ where: { id: parsedSubjectId } }),
      prisma.topic.findUnique({ where: { id: parsedTopicId } }),
      prisma.question.findMany({
        where: { id: { in: normalizedQuestionIds } },
        select: { id: true, topicId: true, quiz: { select: { topicId: true } } },
      }),
    ]);

    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    if (topic.subjectId !== parsedSubjectId) {
      return res.status(400).json({ message: 'The selected topic does not belong to the selected subject' });
    }
    if (existingQuestions.length !== normalizedQuestionIds.length) {
      return res.status(400).json({ message: 'Some selected questions do not exist' });
    }

    const invalidQuestion = existingQuestions.find((item) => item.topicId !== parsedTopicId && item.quiz?.topicId !== parsedTopicId);
    if (invalidQuestion) {
      return res.status(400).json({ message: 'All selected questions must belong to the chosen topic' });
    }

    const mockExam = await prisma.mockExam.create({
      data: {
        title: String(title).trim(),
        instructions: instructions ? String(instructions).trim() : null,
        durationMinutes: parsedDuration,
        subjectId: parsedSubjectId,
        topicId: parsedTopicId,
        questions: { create: normalizedQuestionIds.map((questionId) => ({ questionId })) },
      },
      include: {
        subject: { select: { id: true, name: true, grade: true } },
        topic: { select: { id: true, title: true } },
        questions: { include: { question: true } },
      },
    });

    return res.status(201).json({ message: 'Mock exam created successfully', mockExam: decorateMockExam(mockExam) });
  } catch (error) {
    console.error('POST /api/mock-exams error:', error);
    return res.status(500).json({ message: 'Failed to create mock exam' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Invalid mock exam ID' });
    }

    const existing = await prisma.mockExam.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Mock exam not found' });
    }

    await prisma.mockExam.delete({ where: { id } });
    return res.json({ message: 'Mock exam deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/mock-exams/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete mock exam' });
  }
});

module.exports = router;
