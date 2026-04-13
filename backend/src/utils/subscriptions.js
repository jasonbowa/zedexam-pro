const prisma = require('../lib/prisma');

const DEFAULT_FREE_CAPABILITIES = Object.freeze({
  planName: 'Free',
  maxSubjects: 2,
  maxMockExams: 1,
  includesReports: false,
  includesCertificates: false,
  isFree: true,
});

function toCapabilities(subscription) {
  if (!subscription?.package) {
    return { ...DEFAULT_FREE_CAPABILITIES };
  }

  return {
    planName: subscription.package.name || 'Custom Plan',
    maxSubjects: subscription.package.maxSubjects ?? null,
    maxMockExams: subscription.package.maxMockExams ?? null,
    includesReports: Boolean(subscription.package.includesReports),
    includesCertificates: Boolean(subscription.package.includesCertificates),
    isFree: false,
  };
}

async function getActiveSubscription(studentId, now = new Date()) {
  if (!studentId) return null;

  return prisma.studentSubscription.findFirst({
    where: {
      studentId: Number(studentId),
      status: 'ACTIVE',
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      package: { active: true },
    },
    orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    include: { package: true, school: true },
  });
}

async function getStudentPlanContext(studentId, now = new Date()) {
  const subscription = await getActiveSubscription(studentId, now);
  const capabilities = toCapabilities(subscription);
  return { subscription, capabilities };
}

function applyLimit(items, limit) {
  if (!Array.isArray(items)) return [];
  if (limit === null || limit === undefined) return items;
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return items;
  if (parsed <= 0) return [];
  return items.slice(0, parsed);
}

async function listAccessibleSubjectsForStudent(student) {
  if (!student) return { subscription: null, capabilities: { ...DEFAULT_FREE_CAPABILITIES }, subjects: [] };
  const { subscription, capabilities } = await getStudentPlanContext(student.id);
  const where = student.grade ? { grade: student.grade } : {};
  const subjects = await prisma.subject.findMany({
    where,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

  return {
    subscription,
    capabilities,
    subjects: applyLimit(subjects, capabilities.maxSubjects),
  };
}

async function getAccessibleSubjectIdsForStudent(student) {
  const { subscription, capabilities, subjects } = await listAccessibleSubjectsForStudent(student);
  return {
    subscription,
    capabilities,
    subjectIds: subjects.map((subject) => subject.id),
  };
}

async function ensureStudentCanAccessSubject(student, subjectId) {
  const normalizedId = Number(subjectId);
  if (!student || Number.isNaN(normalizedId)) {
    return { allowed: false, reason: 'Invalid subject access request', status: 400 };
  }

  const { subscription, capabilities, subjectIds } = await getAccessibleSubjectIdsForStudent(student);
  const allowed = subjectIds.includes(normalizedId);

  if (!allowed) {
    return {
      allowed: false,
      status: 403,
      reason: capabilities.isFree
        ? 'Upgrade from the Free plan to unlock more subjects for your grade.'
        : 'This subject is outside the current plan allowance for this learner.',
      subscription,
      capabilities,
    };
  }

  return { allowed: true, subscription, capabilities };
}

async function listAccessibleMockExamsForStudent(student, options = {}) {
  if (!student) return { subscription: null, capabilities: { ...DEFAULT_FREE_CAPABILITIES }, mockExams: [] };
  const { subscription, capabilities } = await getStudentPlanContext(student.id);

  const where = { ...(options.where || {}) };
  if (student.grade) {
    where.subject = { ...(where.subject || {}), grade: student.grade };
  }

  const mockExams = await prisma.mockExam.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: options.include || undefined,
  });

  return {
    subscription,
    capabilities,
    mockExams: applyLimit(mockExams, capabilities.maxMockExams),
  };
}

async function ensureStudentCanAccessMockExam(student, mockExamId) {
  const normalizedId = Number(mockExamId);
  if (!student || Number.isNaN(normalizedId)) {
    return { allowed: false, reason: 'Invalid mock exam access request', status: 400 };
  }

  const exam = await prisma.mockExam.findUnique({
    where: { id: normalizedId },
    include: { subject: { select: { id: true, grade: true } } },
  });

  if (!exam) {
    return { allowed: false, reason: 'Mock exam not found', status: 404 };
  }

  if (student.grade && exam.subject?.grade && student.grade !== exam.subject.grade) {
    return { allowed: false, reason: 'This mock exam is not available for the learner grade.', status: 403 };
  }

  const { subscription, capabilities, mockExams } = await listAccessibleMockExamsForStudent(student);
  const allowed = mockExams.some((item) => Number(item.id) == normalizedId);

  if (!allowed) {
    return {
      allowed: false,
      status: 403,
      reason: capabilities.isFree
        ? 'Upgrade from the Free plan to unlock more mock exams.'
        : 'This mock exam is outside the current plan allowance for this learner.',
      subscription,
      capabilities,
      exam,
    };
  }

  return { allowed: true, subscription, capabilities, exam };
}

module.exports = {
  DEFAULT_FREE_CAPABILITIES,
  getActiveSubscription,
  getStudentPlanContext,
  listAccessibleSubjectsForStudent,
  getAccessibleSubjectIdsForStudent,
  ensureStudentCanAccessSubject,
  listAccessibleMockExamsForStudent,
  ensureStudentCanAccessMockExam,
};
