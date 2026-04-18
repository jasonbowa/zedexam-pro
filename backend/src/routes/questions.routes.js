const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const env = require('../config/env');
const { requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { normalizeQuestionType } = require('../utils/normalizers');
const { logAdminAction } = require('../utils/audit');

async function getOrCreateQuizForTopic(topicId) {
  const existingQuiz = await prisma.quiz.findFirst({ where: { topicId }, orderBy: { id: 'asc' } });
  if (existingQuiz) return existingQuiz;
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return null;
  return prisma.quiz.create({ data: { title: `${topic.title} Quiz`, topicId } });
}

function normalizeNullableString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeCorrectChoice(payload) {
  const choice = String(payload.correctAnswer || '').trim();
  if (!choice) return null;

  const optionMap = {
    A: payload.optionA,
    B: payload.optionB,
    C: payload.optionC,
    D: payload.optionD,
  };

  const upper = choice.toUpperCase();
  return optionMap[upper] || choice;
}

function normalizeQuestionPayload(body = {}) {
  const questionType = normalizeQuestionType(body.questionType);
  const payload = {
    questionType,
    question: String(body.question || body.text || '').trim(),
    passage: normalizeNullableString(body.passage),
    imageUrl: normalizeNullableString(body.imageUrl || body.image),
    optionA: normalizeNullableString(body.optionA),
    optionB: normalizeNullableString(body.optionB),
    optionC: normalizeNullableString(body.optionC),
    optionD: normalizeNullableString(body.optionD),
    correctAnswer: normalizeNullableString(body.correctAnswer),
    answerText: normalizeNullableString(body.answerText),
    explanation: normalizeNullableString(body.explanation),
    difficulty: normalizeNullableString(body.difficulty),
    marks: Number(body.marks) > 0 ? Number(body.marks) : 1,
    year: Number(body.year) > 0 ? Number(body.year) : null,
    paper: normalizeNullableString(body.paper),
    section: normalizeNullableString(body.section),
  };

  if (['MCQ', 'PASSAGE_BASED', 'IMAGE_BASED'].includes(questionType)) {
    payload.correctAnswer = normalizeCorrectChoice(payload);
    payload.answerText = null;
  }


  if (questionType === 'IMAGE_BASED') {
    payload.passage = null;
  }

  if (['SHORT_ANSWER', 'STRUCTURED'].includes(questionType)) {
    const answer = normalizeNullableString(body.answerText || body.correctAnswer);
    payload.answerText = answer;
    payload.correctAnswer = answer;
    payload.optionA = null;
    payload.optionB = null;
    payload.optionC = null;
    payload.optionD = null;
    payload.passage = null;
  }

  const errors = [];
  if (!payload.question) errors.push('Question text is required');

  if (['MCQ', 'PASSAGE_BASED', 'IMAGE_BASED'].includes(questionType)) {
    if (!payload.optionA || !payload.optionB || !payload.optionC || !payload.optionD) errors.push('All four options are required');
    if (!payload.correctAnswer) errors.push('correctAnswer is required');
  }

  if (['SHORT_ANSWER', 'STRUCTURED'].includes(questionType)) {
    if (!payload.answerText && !payload.correctAnswer) errors.push('answerText or correctAnswer is required');
  }

  if (questionType === 'PASSAGE_BASED' && !payload.passage) {
    errors.push('Passage is required for passage-based questions');
  }

  if (questionType === 'IMAGE_BASED' && !payload.imageUrl) {
    errors.push('imageUrl is required for image-based questions');
  }

  if (payload.imageUrl && !/^https?:\/\/|^\/uploads\//i.test(payload.imageUrl)) {
    errors.push('imageUrl must be a full URL or a /uploads/ path');
  }

  return { payload, errors };
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const topicId = req.query.topicId ? Number(req.query.topicId) : null;
    const where = topicId && !Number.isNaN(topicId) ? { OR: [{ topicId }, { quiz: { topicId } }] } : {};

    const questions = await prisma.question.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        topic: {
          select: {
            id: true,
            title: true,
            subjectId: true,
            subject: { select: { id: true, name: true, grade: true } },
          },
        },
        quiz: { select: { id: true, title: true, topicId: true } },
      },
    });

    return res.json(questions);
  } catch (error) {
    console.error('GET /api/questions error:', error);
    return res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

router.get('/topic/:topicId', requireAdmin, async (req, res) => {
  try {
    const topicId = Number(req.params.topicId);
    if (Number.isNaN(topicId)) return res.status(400).json({ message: 'Invalid topic ID' });

    const questions = await prisma.question.findMany({
      where: { OR: [{ topicId }, { quiz: { topicId } }] },
      orderBy: { id: 'asc' },
      include: {
        topic: { select: { id: true, title: true, subjectId: true, subject: { select: { id: true, name: true, grade: true } } } },
        quiz: { select: { id: true, title: true, topicId: true } },
      },
    });

    return res.json(questions);
  } catch (error) {
    console.error('GET /api/questions/topic/:topicId error:', error);
    return res.status(500).json({ message: 'Failed to fetch topic questions' });
  }
});

router.post('/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Image file is required' });
  const imageUrl = `/uploads/${req.file.filename}`;
  logAdminAction(req, 'question_image_uploaded', { filename: req.file.filename, size: req.file.size });
  return res.status(201).json({ message: 'Image uploaded successfully', imageUrl, absoluteUrl: `${env.APP_BASE_URL}${imageUrl}` });
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const topicId = Number(req.body.topicId);
    if (Number.isNaN(topicId)) return res.status(400).json({ message: 'Valid topicId is required' });

    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const quiz = await getOrCreateQuizForTopic(topicId);
    const { payload, errors } = normalizeQuestionPayload(req.body);
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    const created = await prisma.question.create({ data: { ...payload, topicId, quizId: quiz?.id || null } });
    logAdminAction(req, 'question_created', { questionId: created.id, topicId, questionType: created.questionType });
    return res.status(201).json(created);
  } catch (error) {
    console.error('POST /api/questions error:', error);
    return res.status(500).json({ message: 'Failed to create question', errors: [error.message] });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid question ID' });

    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Question not found' });

    const { payload, errors } = normalizeQuestionPayload(req.body);
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    const updated = await prisma.question.update({ where: { id }, data: payload });
    logAdminAction(req, 'question_updated', { questionId: id, questionType: updated.questionType });
    return res.json(updated);
  } catch (error) {
    console.error('PUT /api/questions/:id error:', error);
    return res.status(500).json({ message: 'Failed to update question', errors: [error.message] });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid question ID' });

    await prisma.question.delete({ where: { id } });
    logAdminAction(req, 'question_deleted', { questionId: id });
    return res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/questions/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete question', errors: [error.message] });
  }
});

module.exports = router;
