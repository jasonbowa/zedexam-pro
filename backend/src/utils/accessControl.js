const prisma = require('../lib/prisma');
const { getPaymentInstructions } = require('./payment');
const { ensureStudentSubscriptionSchema } = require('./studentSubscriptions');

const FREE_ACCESS = new Set(['', 'FREE', 'ALL', 'NONE']);

function normalizeAccessLevel(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function getExpiredStatus(subscription) {
  if (!subscription) return 'INACTIVE';
  if (subscription.endDate && new Date(subscription.endDate).getTime() < Date.now()) return 'EXPIRED';
  return String(subscription.status || 'PENDING').toUpperCase();
}

async function getLatestStudentSubscription(studentId) {
  if (!studentId) return null;
  await ensureStudentSubscriptionSchema();
  return prisma.studentSubscription.findFirst({
    where: { studentId: Number(studentId) },
    orderBy: [{ createdAt: 'desc' }],
    include: { package: true, school: true },
  });
}

async function getActiveStudentSubscription(studentId) {
  const subscription = await getLatestStudentSubscription(studentId);
  if (!subscription) return null;

  const status = getExpiredStatus(subscription);
  if (status === 'EXPIRED' && subscription.status === 'ACTIVE') {
    await prisma.studentSubscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    }).catch(() => null);
  }

  return status === 'ACTIVE' ? subscription : null;
}

function buildStudentAccessPayload(subscription) {
  const status = getExpiredStatus(subscription);
  const active = status === 'ACTIVE';
  return {
    status,
    isActive: active,
    package: subscription?.package || null,
    subscriptionId: subscription?.id || null,
    startsAt: subscription?.startDate || null,
    expiresAt: subscription?.endDate || null,
    reason: active ? null : 'Package activation is required for this content.',
    paymentInstructions: active ? null : getPaymentInstructions(),
  };
}

async function getAllowedSubjectIdsForPackage(pkg) {
  const limit = Number(pkg?.maxSubjects || 0);
  if (!limit || limit < 1) return null;

  const subjects = await prisma.subject.findMany({
    orderBy: [{ grade: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    take: limit,
    select: { id: true },
  });
  return new Set(subjects.map((subject) => subject.id));
}

async function canStudentAccessSubject(user, subjectId) {
  if (user?.isAdmin) return { allowed: true, subscription: null, access: { status: 'ACTIVE', isActive: true } };
  if (!user || user.role !== 'student') return { allowed: true, subscription: null, access: { status: 'PUBLIC', isActive: true } };

  const subscription = await getActiveStudentSubscription(user.id);
  if (!subscription) {
    const latest = await getLatestStudentSubscription(user.id);
    return { allowed: false, subscription: latest, access: buildStudentAccessPayload(latest) };
  }

  const allowedSubjectIds = await getAllowedSubjectIdsForPackage(subscription.package);
  const allowed = !allowedSubjectIds || allowedSubjectIds.has(Number(subjectId));
  return {
    allowed,
    subscription,
    access: {
      ...buildStudentAccessPayload(subscription),
      reason: allowed ? null : 'This subject is outside the subject limit for the current package.',
    },
  };
}

async function canStudentAccessTopic(user, topicId) {
  const topic = await prisma.topic.findUnique({
    where: { id: Number(topicId) },
    select: { id: true, subjectId: true, title: true, subject: { select: { id: true, name: true, grade: true } } },
  });
  if (!topic) return { allowed: false, notFound: true, access: { status: 'NOT_FOUND', isActive: false } };
  const result = await canStudentAccessSubject(user, topic.subjectId);
  return { ...result, topic };
}

async function canStudentAccessMockExam(user, mockExamOrId) {
  if (user?.isAdmin) return { allowed: true, subscription: null, access: { status: 'ACTIVE', isActive: true } };
  const mockExam = typeof mockExamOrId === 'object' && mockExamOrId
    ? mockExamOrId
    : await prisma.mockExam.findUnique({
        where: { id: Number(mockExamOrId) },
        select: { id: true, subjectId: true, topicId: true, title: true },
      });
  if (!mockExam) return { allowed: false, notFound: true, access: { status: 'NOT_FOUND', isActive: false } };

  const subjectAccess = await canStudentAccessSubject(user, mockExam.subjectId);
  if (!subjectAccess.allowed) return { ...subjectAccess, mockExam };

  const limit = Number(subjectAccess.subscription?.package?.maxMockExams || 0);
  if (!limit || limit < 1) return { ...subjectAccess, mockExam };

  const allowedMocks = await prisma.mockExam.findMany({
    where: { subjectId: mockExam.subjectId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: limit,
    select: { id: true },
  });
  const allowedIds = new Set(allowedMocks.map((item) => item.id));
  const allowed = allowedIds.has(Number(mockExam.id));
  return {
    ...subjectAccess,
    allowed,
    mockExam,
    access: {
      ...subjectAccess.access,
      reason: allowed ? null : 'This mock exam is outside the mock exam limit for the current package.',
    },
  };
}

async function decorateSubjectsForStudent(user, subjects) {
  if (!user || user.isAdmin || user.role !== 'student') return subjects;
  const subscription = await getActiveStudentSubscription(user.id);
  const latest = subscription || await getLatestStudentSubscription(user.id);
  const activeAccess = buildStudentAccessPayload(latest);
  const allowedSubjectIds = subscription ? await getAllowedSubjectIdsForPackage(subscription.package) : new Set();

  return subjects.map((subject) => {
    const locked = !subscription || (allowedSubjectIds && !allowedSubjectIds.has(Number(subject.id)));
    return {
      ...subject,
      accessLocked: locked,
      accessReason: locked
        ? (!subscription ? 'Package activation required' : 'Outside current package subject limit')
        : null,
      access: activeAccess,
    };
  });
}

function materialMatchesPackage(material, subscription) {
  const accessLevel = normalizeAccessLevel(material.accessLevel);
  if (FREE_ACCESS.has(accessLevel)) return true;
  if (!subscription?.package) return false;
  if (accessLevel === 'PAID' || accessLevel === 'ACTIVE_PACKAGE') return true;
  return normalizeAccessLevel(subscription.package.name) === accessLevel;
}

function canViewMaterial(material, subscription) {
  return materialMatchesPackage(material, subscription);
}

function canDownloadMaterial(material, subscription) {
  return materialMatchesPackage(material, subscription);
}

function deniedPayload(access, fallbackMessage = 'Your package is not active for this content yet') {
  return {
    message: fallbackMessage,
    access: access || buildStudentAccessPayload(null),
  };
}

async function resolveTeacherPackage(user) {
  if (!user) return null;
  if (user.packageId) {
    const byId = await prisma.subscriptionPackage.findUnique({ where: { id: Number(user.packageId) } });
    if (byId) return byId;
  }
  if (user.package) {
    return prisma.subscriptionPackage.findFirst({ where: { name: user.package, active: true } });
  }
  return prisma.subscriptionPackage.findFirst({
    where: { active: true, name: { contains: 'Teacher', mode: 'insensitive' } },
    orderBy: [{ priceZmw: 'asc' }],
  });
}

async function getTeacherExpiryDate(user, startDate, explicitExpiresAt) {
  if (explicitExpiresAt) return new Date(explicitExpiresAt);
  const plan = await resolveTeacherPackage(user);
  const days = Number(plan?.durationDays || 90);
  const expiresAt = new Date(startDate);
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

module.exports = {
  buildStudentAccessPayload,
  canDownloadMaterial,
  canStudentAccessSubject,
  canStudentAccessMockExam,
  canStudentAccessTopic,
  canViewMaterial,
  decorateSubjectsForStudent,
  deniedPayload,
  getActiveStudentSubscription,
  getLatestStudentSubscription,
  getTeacherExpiryDate,
  materialMatchesPackage,
  resolveTeacherPackage,
};
