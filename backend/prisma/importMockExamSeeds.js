const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const seedPath = path.join(__dirname, 'mockExamSeedData.json');

function asNullableString(value) {
  const text = String(value || '').trim();
  return text || null;
}

async function findOrCreateSubject(exam) {
  return prisma.subject.upsert({
    where: {
      name_grade: {
        name: exam.subject,
        grade: exam.grade || 'FORM_4',
      },
    },
    update: {},
    create: {
      name: exam.subject,
      grade: exam.grade || 'FORM_4',
      description: `${exam.subject} mixed mock exam practice`,
    },
  });
}

async function findOrCreateTopic(subject, title) {
  const existing = await prisma.topic.findFirst({
    where: { subjectId: subject.id, title },
    orderBy: { id: 'asc' },
  });
  if (existing) return existing;
  return prisma.topic.create({
    data: {
      subjectId: subject.id,
      title,
      description: 'Full-paper mixed mock exam practice',
    },
  });
}

async function importExam(exam) {
  const existing = await prisma.mockExam.findFirst({
    where: { title: exam.title },
    select: { id: true, title: true },
  });
  if (existing) {
    return { title: exam.title, status: 'skipped' };
  }

  const subject = await findOrCreateSubject(exam);
  const topic = await findOrCreateTopic(subject, exam.topic || 'Mixed Mock Exams');
  const questionIds = [];

  for (const item of exam.questions || []) {
    const created = await prisma.question.create({
      data: {
        topicId: topic.id,
        questionType: item.questionType || 'MCQ',
        question: String(item.question || '').trim(),
        passage: asNullableString(item.passage),
        imageUrl: asNullableString(item.imageUrl),
        optionA: asNullableString(item.optionA),
        optionB: asNullableString(item.optionB),
        optionC: asNullableString(item.optionC),
        optionD: asNullableString(item.optionD),
        correctAnswer: asNullableString(item.correctAnswer),
        answerText: asNullableString(item.answerText),
        explanation: asNullableString(item.explanation),
        marks: Number(item.marks || 1),
        difficulty: asNullableString(item.difficulty),
        section: asNullableString(item.section),
        paper: exam.title,
      },
      select: { id: true },
    });
    questionIds.push(created.id);
  }

  await prisma.mockExam.create({
    data: {
      title: exam.title,
      instructions: exam.instructions || 'Answer all questions.',
      durationMinutes: Number(exam.durationMinutes || 90),
      subjectId: subject.id,
      topicId: topic.id,
      questions: {
        create: questionIds.map((questionId) => ({ questionId })),
      },
    },
  });

  return { title: exam.title, status: 'inserted', questions: questionIds.length };
}

async function main() {
  if (!fs.existsSync(seedPath)) {
    console.log('Mock exam seed data not found; skipping import.');
    return;
  }

  const exams = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  let inserted = 0;
  let skipped = 0;
  let questions = 0;

  for (const exam of exams) {
    const result = await importExam(exam);
    if (result.status === 'inserted') {
      inserted += 1;
      questions += result.questions || 0;
    } else {
      skipped += 1;
    }
  }

  console.log(`Mock exam seed import complete: ${inserted} inserted, ${skipped} skipped, ${questions} questions added.`);
}

main()
  .catch((error) => {
    console.error('Failed to import mock exam seeds:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
