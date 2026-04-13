const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const env = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { buildCertificatePayload, buildCertificateCode } = require('../utils/certificates');
const { getStudentPlanContext, ensureStudentCanAccessMockExam } = require('../utils/subscriptions');

async function getOrCreateQuizForTopic(topicId, title) {
  const existingQuiz = await prisma.quiz.findFirst({ where: { topicId }, orderBy: { id: 'asc' } });
  if (existingQuiz) return existingQuiz;
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return null;
  return prisma.quiz.create({ data: { title: title ? String(title).trim() : `${topic.title} Quiz`, topicId } });
}

async function resolveQuiz({ quizId, topicId, quizTitle, mockExamId }) {
  const parsedQuizId = Number(quizId);
  if (!Number.isNaN(parsedQuizId) && parsedQuizId > 0) {
    const quiz = await prisma.quiz.findUnique({ where: { id: parsedQuizId } });
    if (quiz) return quiz;
  }

  const parsedMockExamId = Number(mockExamId);
  if (!Number.isNaN(parsedMockExamId) && parsedMockExamId > 0) {
    const mockExam = await prisma.mockExam.findUnique({ where: { id: parsedMockExamId }, include: { topic: true } });
    if (mockExam) return getOrCreateQuizForTopic(mockExam.topicId, mockExam.title || quizTitle);
  }

  const parsedTopicId = Number(topicId);
  if (!Number.isNaN(parsedTopicId) && parsedTopicId > 0) return getOrCreateQuizForTopic(parsedTopicId, quizTitle);
  return null;
}

function buildResultWhere(req) {
  if (req.user?.isAdmin) {
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;
    if (studentId && !Number.isNaN(studentId)) return { studentId };
    return {};
  }
  return { studentId: Number(req.user.id) };
}

function serializeResult(result, options = {}) {
  const total = Number(result.total || 0);
  const score = Number(result.score || 0);
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const certificatesEnabled = options.certificatesEnabled !== false;
  const certificate = certificatesEnabled && percentage >= 50 ? buildCertificatePayload({ result, secret: env.AUTH_SECRET, baseUrl: env.APP_BASE_URL }) : null;

  return {
    ...result,
    percentage,
    title: result.mockExam?.title || result.quizTitle || result.quiz?.title || result.quiz?.topic?.title || 'Quiz',
    topicName: result.mockExam?.topic?.title || result.quiz?.topic?.title || result.topicName || null,
    mock: result.mockExam ? { id: result.mockExam.id, title: result.mockExam.title, durationMinutes: result.mockExam.durationMinutes } : null,
    mockExamId: result.mockExamId || result.mockExam?.id || null,
    certificate,
  };
}

function normalizeComparable(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getAnswerValue(answers, questionId) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return '';
  return answers[questionId] ?? answers[String(questionId)] ?? '';
}

function isAutoScorable(question) {
  return ['MCQ', 'PASSAGE_BASED', 'IMAGE_BASED', 'SHORT_ANSWER', 'STRUCTURED'].includes(String(question.questionType || ''));
}

function resolveCorrectAnswer(question) {
  return question.correctAnswer || question.answerText || '';
}

function scoreAttempt(questions, answers) {
  const normalizedAnswers = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const total = questions.reduce((sum, question) => sum + Number(question.marks || 1), 0);

  let score = 0;
  for (const question of questions) {
    if (!isAutoScorable(question)) continue;
    const submitted = normalizeComparable(getAnswerValue(normalizedAnswers, question.id));
    const expected = normalizeComparable(resolveCorrectAnswer(question));
    if (submitted && expected && submitted === expected) {
      score += Number(question.marks || 1);
    }
  }

  return { score, total };
}

async function getQuestionsForAttempt({ quiz, topicId, mockExamId }) {
  const parsedMockExamId = Number(mockExamId);
  if (!Number.isNaN(parsedMockExamId) && parsedMockExamId > 0) {
    const mockExam = await prisma.mockExam.findUnique({
      where: { id: parsedMockExamId },
      include: {
        questions: {
          orderBy: { id: 'asc' },
          include: {
            question: {
              select: {
                id: true,
                questionType: true,
                marks: true,
                optionA: true,
                optionB: true,
                optionC: true,
                optionD: true,
                correctAnswer: true,
                answerText: true,
              },
            },
          },
        },
      },
    });

    if (!mockExam) return { mockExam: null, questions: [] };
    return {
      mockExam,
      questions: mockExam.questions.map((link) => link.question).filter(Boolean),
    };
  }

  const parsedTopicId = Number(topicId);
  const where = parsedTopicId > 0
    ? { OR: [{ topicId: parsedTopicId }, { quizId: quiz.id }, { quiz: { topicId: parsedTopicId } }] }
    : { OR: [{ quizId: quiz.id }, { quiz: { topicId: quiz.topicId } }] };

  const questions = await prisma.question.findMany({
    where,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      questionType: true,
      marks: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correctAnswer: true,
      answerText: true,
    },
  });

  return { mockExam: null, questions };
}

async function includeResultById(id) {
  return prisma.quizAttempt.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, email: true, phoneNumber: true, grade: true, isActive: true, status: true } },
      quiz: { include: { topic: { select: { id: true, title: true, subject: { select: { id: true, name: true, grade: true } } } } } },
      mockExam: { select: { id: true, title: true, durationMinutes: true, topic: { select: { id: true, title: true } } } },
    },
  });
}

router.get('/:id/verify', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const code = String(req.query.code || '').trim().toUpperCase();
    if (Number.isNaN(id) || !code) return res.status(400).json({ message: 'Result ID and code are required' });

    const result = await includeResultById(id);
    if (!result) return res.status(404).json({ message: 'Result not found' });

    const expected = buildCertificateCode({ resultId: result.id, studentId: result.studentId, secret: env.AUTH_SECRET });
    const verified = expected === code;
    const percentage = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;

    return res.json({
      verified,
      certificateCode: code,
      student: result.student ? { name: result.student.name, grade: result.student.grade } : null,
      title: result.mockExam?.title || result.quizTitle || result.quiz?.title || result.quiz?.topic?.title || 'Quiz',
      topicName: result.mockExam?.topic?.title || result.quiz?.topic?.title || null,
      score: result.score,
      total: result.total,
      percentage,
      issuedAt: result.createdAt,
    });
  } catch (error) {
    console.error('GET /api/results/:id/verify error:', error);
    return res.status(500).json({ message: 'Failed to verify certificate' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { studentId, quizId, topicId, mockExamId, quizTitle, score, total, totalQuestions, totalMarks, answers } = req.body;
    const parsedMockExamId = Number(mockExamId);
    const quiz = await resolveQuiz({ quizId, topicId, quizTitle, mockExamId: parsedMockExamId });
    if (!quiz) return res.status(400).json({ message: 'A valid quizId, topicId, or mockExamId is required' });

    let parsedStudentId = req.user?.isAdmin ? Number(studentId) : Number(req.user?.id);
    if (!parsedStudentId || Number.isNaN(parsedStudentId)) return res.status(400).json({ message: 'Student ID is required' });

    const studentExists = await prisma.student.findUnique({ where: { id: parsedStudentId } });
    if (!studentExists || studentExists.deletedAt) return res.status(400).json({ message: `Student with ID ${parsedStudentId} does not exist` });
    if (studentExists.isActive === false || String(studentExists.status || '').toLowerCase() === 'inactive') {
      return res.status(400).json({ message: `Student with ID ${parsedStudentId} is deactivated` });
    }

    if (!req.user?.isAdmin && !Number.isNaN(parsedMockExamId) && parsedMockExamId > 0) {
      const mockAccess = await ensureStudentCanAccessMockExam(studentExists, parsedMockExamId);
      if (!mockAccess.allowed) {
        return res.status(mockAccess.status || 403).json({ message: mockAccess.reason });
      }
    }

    const { mockExam: mockExamExists, questions } = await getQuestionsForAttempt({ quiz, topicId, mockExamId: parsedMockExamId });
    if (!questions.length) {
      return res.status(400).json({ message: 'This quiz or mock exam does not have any scorable questions yet' });
    }
    if (!Number.isNaN(parsedMockExamId) && parsedMockExamId > 0 && !mockExamExists) {
      return res.status(400).json({ message: `Mock exam with ID ${parsedMockExamId} does not exist` });
    }

    const hasAnswersPayload = answers && typeof answers === 'object' && !Array.isArray(answers);
    let computedScore = null;
    let computedTotal = null;

    if (hasAnswersPayload) {
      const scored = scoreAttempt(questions, answers);
      computedScore = scored.score;
      computedTotal = scored.total;
    } else if (req.user?.isAdmin) {
      const parsedScore = Number(score);
      const parsedTotal = Number(total ?? totalQuestions ?? totalMarks);
      if (Number.isNaN(parsedScore) || Number.isNaN(parsedTotal)) {
        return res.status(400).json({ message: 'Answers are required for student submissions, or provide valid score and total for admin-created results' });
      }
      if (parsedScore < 0 || parsedTotal < 1 || parsedScore > parsedTotal) {
        return res.status(400).json({ message: 'Score must be between 0 and total, and total must be at least 1' });
      }
      computedScore = parsedScore;
      computedTotal = parsedTotal;
    } else {
      return res.status(400).json({ message: 'Answers are required for quiz submission' });
    }

    const result = await prisma.quizAttempt.create({
      data: {
        studentId: parsedStudentId,
        quizId: quiz.id,
        mockExamId: mockExamExists?.id || null,
        quizTitle: String(quizTitle || mockExamExists?.title || quiz.title || '').trim() || null,
        score: computedScore,
        total: computedTotal,
        answers: hasAnswersPayload ? answers : undefined,
      },
      include: {
        student: { select: { id: true, name: true, email: true, phoneNumber: true, grade: true, isActive: true, status: true } },
        quiz: { include: { topic: { select: { id: true, title: true, subject: { select: { id: true, name: true, grade: true } } } } } },
        mockExam: { select: { id: true, title: true, durationMinutes: true, topic: { select: { id: true, title: true } } } },
      },
    });

    const certificatesEnabled = req.user?.isAdmin ? true : (await getStudentPlanContext(parsedStudentId)).capabilities.includesCertificates;
    return res.json({ message: 'Result saved successfully', result: serializeResult(result, { certificatesEnabled }) });
  } catch (error) {
    console.error('POST /api/results error:', error);
    return res.status(500).json({ message: 'Failed to save result', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const results = await prisma.quizAttempt.findMany({
      where: buildResultWhere(req),
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, email: true, phoneNumber: true, grade: true, isActive: true, status: true } },
        quiz: { include: { topic: { select: { id: true, title: true, subject: { select: { id: true, name: true, grade: true } } } } } },
        mockExam: { select: { id: true, title: true, durationMinutes: true, topic: { select: { id: true, title: true } } } },
      },
    });
    const certificatesEnabled = req.user?.isAdmin ? true : (await getStudentPlanContext(req.user.id)).capabilities.includesCertificates;
    return res.json(results.map((item) => serializeResult(item, { certificatesEnabled })));
  } catch (error) {
    console.error('GET /api/results error:', error);
    return res.status(500).json({ message: 'Failed to fetch results' });
  }
});

router.get('/my-results', requireAuth, async (req, res) => {
  try {
    const results = await prisma.quizAttempt.findMany({
      where: req.user?.isAdmin ? {} : { studentId: Number(req.user.id) },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, email: true, phoneNumber: true, grade: true, isActive: true, status: true } },
        quiz: { include: { topic: { select: { id: true, title: true, subject: { select: { id: true, name: true, grade: true } } } } } },
        mockExam: { select: { id: true, title: true, durationMinutes: true, topic: { select: { id: true, title: true } } } },
      },
    });
    const certificatesEnabled = req.user?.isAdmin ? true : (await getStudentPlanContext(req.user.id)).capabilities.includesCertificates;
    return res.json(results.map((item) => serializeResult(item, { certificatesEnabled })));
  } catch (error) {
    console.error('GET /api/results/my-results error:', error);
    return res.status(500).json({ message: 'Failed to fetch my results' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid result ID' });
    const result = await includeResultById(id);
    if (!result) return res.status(404).json({ message: 'Result not found' });
    if (!req.user?.isAdmin && Number(result.studentId) !== Number(req.user.id)) return res.status(403).json({ message: 'Not allowed to view this result' });
    const certificatesEnabled = req.user?.isAdmin ? true : (await getStudentPlanContext(req.user.id)).capabilities.includesCertificates;
    return res.json(serializeResult(result, { certificatesEnabled }));
  } catch (error) {
    console.error('GET /api/results/:id error:', error);
    return res.status(500).json({ message: 'Failed to fetch result' });
  }
});

module.exports = router;
