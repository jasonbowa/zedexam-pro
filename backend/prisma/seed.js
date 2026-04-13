const { PrismaClient, GradeLevel } = require('@prisma/client');
const { hashPassword } = require('../src/utils/security');

const prisma = new PrismaClient();

async function ensureTopicWithQuiz(subject, title, description) {
  let topic = await prisma.topic.findFirst({
    where: { title, subjectId: subject.id },
  });

  if (!topic) {
    topic = await prisma.topic.create({
      data: { title, description, subjectId: subject.id },
    });
  }

  let quiz = await prisma.quiz.findFirst({
    where: { topicId: topic.id },
    orderBy: { id: 'asc' },
  });

  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: { title: `${title} Quiz`, topicId: topic.id },
    });
  }

  return { topic, quiz };
}

async function ensureQuestion(quizId, topicId, payload) {
  const existing = await prisma.question.findFirst({
    where: { quizId, question: payload.question },
  });

  if (existing) return existing;

  return prisma.question.create({
    data: {
      quizId,
      topicId,
      marks: 1,
      questionType: 'MCQ',
      ...payload,
    },
  });
}

async function main() {
  const demoPassword = '123456';

  const student = await prisma.student.upsert({
    where: { phoneNumber: '0970000000' },
    update: {
      name: 'Demo Student',
      email: 'student@demo.com',
      password: hashPassword(demoPassword),
      grade: GradeLevel.FORM_4,
      school: 'Demo Secondary School',
      status: 'active',
      isActive: true,
      deletedAt: null,
      deactivatedAt: null,
    },
    create: {
      name: 'Demo Student',
      phoneNumber: '0970000000',
      email: 'student@demo.com',
      password: hashPassword(demoPassword),
      grade: GradeLevel.FORM_4,
      school: 'Demo Secondary School',
      status: 'active',
      isActive: true,
    },
  });

  const [ictSubject, mathSubject, englishSubject, scienceSubject] = await Promise.all([
    prisma.subject.upsert({
      where: { name_grade: { name: 'ICT', grade: GradeLevel.FORM_4 } },
      update: { description: 'ICT practice and exam preparation' },
      create: { name: 'ICT', description: 'ICT practice and exam preparation', grade: GradeLevel.FORM_4 },
    }),
    prisma.subject.upsert({
      where: { name_grade: { name: 'Mathematics', grade: GradeLevel.FORM_4 } },
      update: { description: 'Math revision and exam preparation' },
      create: { name: 'Mathematics', description: 'Math revision and exam preparation', grade: GradeLevel.FORM_4 },
    }),
    prisma.subject.upsert({
      where: { name_grade: { name: 'English', grade: GradeLevel.FORM_4 } },
      update: { description: 'English grammar and comprehension' },
      create: { name: 'English', description: 'English grammar and comprehension', grade: GradeLevel.FORM_4 },
    }),
    prisma.subject.upsert({
      where: { name_grade: { name: 'Combined Science', grade: GradeLevel.FORM_4 } },
      update: { description: 'Science revision and mock exams' },
      create: { name: 'Combined Science', description: 'Science revision and mock exams', grade: GradeLevel.FORM_4 },
    }),
  ]);

  const ict = await ensureTopicWithQuiz(ictSubject, 'Computer Fundamentals', 'Introduction to computers and common hardware');
  const maths = await ensureTopicWithQuiz(mathSubject, 'Quadratic Equations', 'Solving and interpreting quadratic equations');
  const english = await ensureTopicWithQuiz(englishSubject, 'Comprehension Skills', 'Reading and understanding passages');
  const science = await ensureTopicWithQuiz(scienceSubject, 'Cells and Organisms', 'Basic biology concepts');

  await ensureQuestion(ict.quiz.id, ict.topic.id, {
    question: 'What does CPU stand for?',
    optionA: 'Central Processing Unit',
    optionB: 'Computer Primary Unit',
    optionC: 'Central Power Utility',
    optionD: 'Control Processing Utility',
    correctAnswer: 'Central Processing Unit',
  });
  await ensureQuestion(ict.quiz.id, ict.topic.id, {
    question: 'Which device is used to move the pointer on the screen?',
    optionA: 'Keyboard',
    optionB: 'Mouse',
    optionC: 'Monitor',
    optionD: 'Printer',
    correctAnswer: 'Mouse',
  });
  await ensureQuestion(maths.quiz.id, maths.topic.id, {
    question: 'What is the solution set of x² - 5x + 6 = 0?',
    optionA: 'x = 2 or x = 3',
    optionB: 'x = -2 or x = -3',
    optionC: 'x = 1 or x = 6',
    optionD: 'x = -1 or x = -6',
    correctAnswer: 'x = 2 or x = 3',
  });
  await ensureQuestion(english.quiz.id, english.topic.id, {
    question: 'Which of the following best describes comprehension?',
    optionA: 'Copying a passage word for word',
    optionB: 'Understanding the meaning of a text',
    optionC: 'Memorising punctuation marks',
    optionD: 'Drawing pictures from a story',
    correctAnswer: 'Understanding the meaning of a text',
  });
  await ensureQuestion(science.quiz.id, science.topic.id, {
    question: 'Which part of a cell controls its activities?',
    optionA: 'Cell membrane',
    optionB: 'Nucleus',
    optionC: 'Cytoplasm',
    optionD: 'Cell wall',
    correctAnswer: 'Nucleus',
  });

  const existingMock = await prisma.mockExam.findFirst({ where: { title: 'ICT Fundamentals Mock' } });
  if (!existingMock) {
    const ictQuestionIds = await prisma.question.findMany({
      where: { topicId: ict.topic.id },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (ictQuestionIds.length) {
      await prisma.mockExam.create({
        data: {
          title: 'ICT Fundamentals Mock',
          instructions: 'Answer all questions. Select the best option.',
          durationMinutes: 30,
          subjectId: ictSubject.id,
          topicId: ict.topic.id,
          questions: {
            create: ictQuestionIds.map(({ id }) => ({ questionId: id })),
          },
        },
      });
    }
  }

  console.log('✅ Seed completed successfully');
  console.log('Demo student login');
  console.log('Phone: 0970000000');
  console.log('Password:', demoPassword);
  console.log('Student ID:', student.id);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
