const express = require('express');
const prisma = require('../lib/prisma');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (_req, res) => {
  try {
    const [studentsCount, activeStudentsCount, inactiveStudentsCount, subjectsCount, topicsCount, questionsCount, attemptsCount, mockExamsCount, recentAttempts] = await Promise.all([
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.student.count({ where: { deletedAt: null, isActive: true } }),
      prisma.student.count({ where: { deletedAt: null, isActive: false } }),
      prisma.subject.count(),
      prisma.topic.count(),
      prisma.question.count(),
      prisma.quizAttempt.count(),
      prisma.mockExam.count(),
      prisma.quizAttempt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          student: { select: { id: true, name: true, grade: true, isActive: true, status: true } },
          quiz: { select: { id: true, title: true } },
        },
      }),
    ]);

    return res.json({
      stats: {
        students: studentsCount,
        activeStudents: activeStudentsCount,
        inactiveStudents: inactiveStudentsCount,
        subjects: subjectsCount,
        topics: topicsCount,
        questions: questionsCount,
        attempts: attemptsCount,
        mockExams: mockExamsCount,
      },
      recentAttempts,
      message: 'Dashboard data loaded',
    });
  } catch (error) {
    console.error('GET /api/dashboard error:', error);
    return res.status(500).json({
      message: 'Failed to load dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
