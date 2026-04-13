const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { getAccessibleSubjectIdsForStudent, ensureStudentCanAccessSubject } = require('../utils/subscriptions');

function sanitizeQuestionForAttempt(question) {
  return {
    id: question.id,
    topicId: question.topicId,
    quizId: question.quizId,
    question: question.question,
    passage: question.passage,
    imageUrl: question.imageUrl,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    questionType: question.questionType,
    marks: question.marks,
    difficulty: question.difficulty,
    year: question.year,
    paper: question.paper,
    section: question.section,
  };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    let where = {};
    if (!req.user?.isAdmin) {
      const { subjectIds } = await getAccessibleSubjectIdsForStudent(req.currentStudent);
      where = subjectIds.length ? { topic: { subjectId: { in: subjectIds } } } : { id: -1 };
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        topic: { select: { id: true, title: true, subjectId: true, subject: { select: { id: true, name: true, grade: true } } } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    return res.json(quizzes);
  } catch (error) {
    console.error('GET /api/quizzes error:', error);
    return res.status(500).json({ message: 'Failed to fetch quizzes' });
  }
});

router.get('/:topicId', requireAuth, async (req, res) => {
  try {
    const topicId = Number(req.params.topicId);
    if (Number.isNaN(topicId)) return res.status(400).json({ message: 'Invalid topic ID' });

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subject: { select: { id: true, name: true, grade: true } },
        quizzes: { orderBy: { id: 'asc' }, select: { id: true, title: true } },
      },
    });

    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    if (!req.user?.isAdmin) {
      const access = await ensureStudentCanAccessSubject(req.currentStudent, topic.subjectId);
      if (!access.allowed) return res.status(access.status || 403).json({ message: access.reason });
    }

    let primaryQuiz = topic.quizzes[0] || null;
    if (!primaryQuiz) {
      primaryQuiz = await prisma.quiz.create({ data: { title: `${topic.title} Quiz`, topicId: topic.id } });
    }

    const questions = await prisma.question.findMany({
      where: { OR: [{ topicId }, { quizId: primaryQuiz.id }, { quiz: { topicId } }] },
      orderBy: [{ id: 'asc' }],
      select: {
        id: true,
        topicId: true,
        quizId: true,
        question: true,
        passage: true,
        imageUrl: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        questionType: true,
        marks: true,
        difficulty: true,
        year: true,
        paper: true,
        section: true,
      },
    });

    return res.json({
      quizId: primaryQuiz.id,
      topicId: topic.id,
      topicTitle: topic.title,
      subjectName: topic.subject?.name || null,
      subjectGrade: topic.subject?.grade || null,
      title: primaryQuiz.title || `${topic.title} Quiz`,
      totalQuestions: questions.length,
      questions: questions.map(sanitizeQuestionForAttempt),
    });
  } catch (error) {
    console.error('GET /api/quizzes/:topicId error:', error);
    return res.status(500).json({ message: 'Failed to fetch quiz data', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

module.exports = router;
