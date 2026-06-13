const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const env = require('../config/env');
const { requireAdmin, requireAuth, requireActiveTeacherMaterials } = require('../middleware/auth');
const { materialUpload } = require('../middleware/upload');
const { logAdminAction } = require('../utils/audit');
const { SUPPORTED_KEY_SUBJECTS, SUBJECT_GUIDANCE } = require('../utils/supportedSubjects');
const {
  canDownloadMaterial,
  canViewMaterial,
  getActiveStudentSubscription,
  getLatestStudentSubscription,
  buildStudentAccessPayload,
} = require('../utils/accessControl');
const { ensureStudentSubscriptionSchema } = require('../utils/studentSubscriptions');

const CONTENT_TYPES = ['NOTE', 'PDF_NOTE', 'TEACHER_NOTE', 'TEACHER_GUIDE', 'DOWNLOAD', 'PRACTICE', 'MOCK_SUPPORT'];
const AUDIENCES = ['STUDENT', 'TEACHER', 'BOTH'];
const STATUSES = ['ACTIVE', 'DRAFT', 'INACTIVE'];
const QUALITY_STATUSES = ['DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED'];
let schemaReadyPromise = null;

function normalizeEnum(value, allowed, fallback) {
  const candidate = String(value || fallback || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return allowed.includes(candidate) ? candidate : null;
}

function normalizeNullableString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function buildMaterialPayload(body = {}) {
  const contentType = normalizeEnum(body.contentType || body.type, CONTENT_TYPES, 'NOTE');
  const audience = normalizeEnum(body.audience, AUDIENCES, 'STUDENT');
  const status = normalizeEnum(body.status, STATUSES, 'ACTIVE');
  const qualityStatus = normalizeEnum(body.qualityStatus, QUALITY_STATUSES, 'DRAFT');
  const payload = {
    title: normalizeNullableString(body.title),
    subjectId: body.subjectId ? Number(body.subjectId) : null,
    topicId: body.topicId ? Number(body.topicId) : null,
    subjectName: normalizeNullableString(body.subjectName || body.subject),
    grade: normalizeNullableString(body.grade || body.form),
    topicTitle: normalizeNullableString(body.topicTitle || body.topic),
    contentType,
    audience,
    accessLevel: normalizeNullableString(body.accessLevel || body.package || body.packageName),
    content: normalizeNullableString(body.content || body.noteContent || body.summary),
    learningObjectives: normalizeNullableString(body.learningObjectives || body.objectives),
    keyConcepts: normalizeNullableString(body.keyConcepts || body.keyTerms),
    workedExamples: normalizeNullableString(body.workedExamples || body.examples),
    summary: normalizeNullableString(body.summary),
    imageUrl: normalizeNullableString(body.imageUrl || body.diagramUrl),
    diagramCaption: normalizeNullableString(body.diagramCaption || body.imageCaption),
    pdfUrl: normalizeNullableString(body.pdfUrl || body.downloadUrl),
    teacherGuidePdfUrl: normalizeNullableString(body.teacherGuidePdfUrl),
    commonMistakes: normalizeNullableString(body.commonMistakes || body.commonLearnerMistakes),
    examStyleGuidance: normalizeNullableString(body.examStyleGuidance),
    answersAndExplanations: normalizeNullableString(body.answersAndExplanations || body.answers),
    status,
    qualityStatus,
  };

  const errors = [];
  if (!payload.title) errors.push('Title is required');
  if (!payload.contentType) errors.push(`contentType must be one of: ${CONTENT_TYPES.join(', ')}`);
  if (!payload.audience) errors.push(`audience must be one of: ${AUDIENCES.join(', ')}`);
  if (!payload.status) errors.push(`status must be one of: ${STATUSES.join(', ')}`);
  if (!payload.qualityStatus) errors.push(`qualityStatus must be one of: ${QUALITY_STATUSES.join(', ')}`);
  if (payload.subjectId !== null && (Number.isNaN(payload.subjectId) || payload.subjectId < 1)) errors.push('subjectId must be valid');
  if (payload.topicId !== null && (Number.isNaN(payload.topicId) || payload.topicId < 1)) errors.push('topicId must be valid');
  if (!payload.content && !payload.imageUrl && !payload.pdfUrl && !payload.teacherGuidePdfUrl) {
    errors.push('Add online content, an image/diagram URL, a PDF URL, or a teacher guide PDF URL');
  }

  return { payload, errors };
}

function serializeMaterial(material, options = {}) {
  const canDownload = options.canDownload ?? true;
  const canView = options.canView ?? true;
  return {
    id: material.id,
    title: material.title,
    subjectId: material.subjectId,
    topicId: material.topicId,
    subject: material.subject?.name || material.subjectName,
    subjectName: material.subject?.name || material.subjectName,
    grade: material.grade || material.subject?.grade || null,
    topic: material.topic?.title || material.topicTitle,
    topicTitle: material.topic?.title || material.topicTitle,
    contentType: material.contentType,
    audience: material.audience,
    accessLevel: material.accessLevel || 'FREE',
    content: canView ? material.content : null,
    learningObjectives: canView ? material.learningObjectives : null,
    keyConcepts: canView ? material.keyConcepts : null,
    workedExamples: canView ? material.workedExamples : null,
    summary: canView ? material.summary : null,
    imageUrl: canView ? material.imageUrl : null,
    diagramCaption: canView ? material.diagramCaption : null,
    pdfUrl: canDownload ? material.pdfUrl : null,
    teacherGuidePdfUrl: canDownload ? material.teacherGuidePdfUrl : null,
    contentLocked: !canView,
    downloadLocked: !canDownload && Boolean(material.pdfUrl || material.teacherGuidePdfUrl),
    canDownload,
    canView,
    access: options.access || null,
    lockedReason: !canView || !canDownload ? 'This material requires an active matching package.' : null,
    commonMistakes: material.commonMistakes,
    examStyleGuidance: material.examStyleGuidance,
    answersAndExplanations: material.answersAndExplanations,
    status: material.status,
    qualityStatus: material.qualityStatus || 'DRAFT',
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

function buildWhereFromQuery(query = {}, audience) {
  const where = { status: 'ACTIVE', qualityStatus: 'PUBLISHED' };
  if (audience === 'STUDENT') where.audience = { in: ['STUDENT', 'BOTH'] };
  if (audience === 'TEACHER') where.audience = { in: ['TEACHER', 'BOTH'] };

  const contentType = query.contentType ? normalizeEnum(query.contentType, CONTENT_TYPES, null) : null;
  if (contentType) where.contentType = contentType;
  if (query.subjectId) where.subjectId = Number(query.subjectId);
  if (query.topicId) where.topicId = Number(query.topicId);
  if (query.subject) where.subjectName = { contains: String(query.subject).trim(), mode: 'insensitive' };
  if (query.grade) where.grade = { contains: String(query.grade).trim(), mode: 'insensitive' };
  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { subjectName: { contains: search, mode: 'insensitive' } },
      { topicTitle: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
}

async function ensureContentMaterialSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContentMaterial" (
      "id" SERIAL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "subjectId" INTEGER,
      "topicId" INTEGER,
      "subjectName" TEXT,
      "grade" TEXT,
      "topicTitle" TEXT,
      "contentType" TEXT NOT NULL DEFAULT 'NOTE',
      "audience" TEXT NOT NULL DEFAULT 'STUDENT',
      "accessLevel" TEXT,
      "content" TEXT,
      "learningObjectives" TEXT,
      "keyConcepts" TEXT,
      "workedExamples" TEXT,
      "summary" TEXT,
      "imageUrl" TEXT,
      "diagramCaption" TEXT,
      "pdfUrl" TEXT,
      "teacherGuidePdfUrl" TEXT,
      "commonMistakes" TEXT,
      "examStyleGuidance" TEXT,
      "answersAndExplanations" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "qualityStatus" TEXT NOT NULL DEFAULT 'DRAFT',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const contentColumns = [
    ['title', 'TEXT'],
    ['subjectId', 'INTEGER'],
    ['topicId', 'INTEGER'],
    ['subjectName', 'TEXT'],
    ['grade', 'TEXT'],
    ['topicTitle', 'TEXT'],
    ['contentType', "TEXT NOT NULL DEFAULT 'NOTE'"],
    ['audience', "TEXT NOT NULL DEFAULT 'STUDENT'"],
    ['accessLevel', 'TEXT'],
    ['content', 'TEXT'],
    ['learningObjectives', 'TEXT'],
    ['keyConcepts', 'TEXT'],
    ['workedExamples', 'TEXT'],
    ['summary', 'TEXT'],
    ['imageUrl', 'TEXT'],
    ['diagramCaption', 'TEXT'],
    ['pdfUrl', 'TEXT'],
    ['teacherGuidePdfUrl', 'TEXT'],
    ['commonMistakes', 'TEXT'],
    ['examStyleGuidance', 'TEXT'],
    ['answersAndExplanations', 'TEXT'],
    ['status', "TEXT NOT NULL DEFAULT 'ACTIVE'"],
    ['qualityStatus', "TEXT NOT NULL DEFAULT 'DRAFT'"],
    ['createdAt', 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ];
  for (const [name, definition] of contentColumns) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ContentMaterial" ADD COLUMN IF NOT EXISTS "${name}" ${definition}`);
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TeacherMaterial" (
      "id" SERIAL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "materialType" TEXT NOT NULL DEFAULT 'NOTE',
      "subject" TEXT,
      "grade" TEXT,
      "topic" TEXT,
      "summary" TEXT,
      "learningObjectives" TEXT,
      "keyConcepts" TEXT,
      "suggestedTeachingMethod" TEXT,
      "commonLearnerDifficulties" TEXT,
      "assessmentQuestions" TEXT,
      "markingGuide" TEXT,
      "downloadUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "qualityStatus" TEXT NOT NULL DEFAULT 'DRAFT',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const teacherColumns = [
    ['title', 'TEXT'],
    ['materialType', "TEXT NOT NULL DEFAULT 'NOTE'"],
    ['subject', 'TEXT'],
    ['grade', 'TEXT'],
    ['topic', 'TEXT'],
    ['summary', 'TEXT'],
    ['learningObjectives', 'TEXT'],
    ['keyConcepts', 'TEXT'],
    ['suggestedTeachingMethod', 'TEXT'],
    ['commonLearnerDifficulties', 'TEXT'],
    ['assessmentQuestions', 'TEXT'],
    ['markingGuide', 'TEXT'],
    ['downloadUrl', 'TEXT'],
    ['status', "TEXT NOT NULL DEFAULT 'ACTIVE'"],
    ['qualityStatus', "TEXT NOT NULL DEFAULT 'DRAFT'"],
    ['createdAt', 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ['updatedAt', 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ];
  for (const [name, definition] of teacherColumns) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "TeacherMaterial" ADD COLUMN IF NOT EXISTS "${name}" ${definition}`);
  }

  const indexes = [
    'CREATE INDEX IF NOT EXISTS "ContentMaterial_subjectId_idx" ON "ContentMaterial"("subjectId")',
    'CREATE INDEX IF NOT EXISTS "ContentMaterial_topicId_idx" ON "ContentMaterial"("topicId")',
    'CREATE INDEX IF NOT EXISTS "ContentMaterial_contentType_idx" ON "ContentMaterial"("contentType")',
    'CREATE INDEX IF NOT EXISTS "ContentMaterial_audience_idx" ON "ContentMaterial"("audience")',
    'CREATE INDEX IF NOT EXISTS "ContentMaterial_accessLevel_idx" ON "ContentMaterial"("accessLevel")',
    'CREATE INDEX IF NOT EXISTS "ContentMaterial_status_idx" ON "ContentMaterial"("status")',
    'CREATE INDEX IF NOT EXISTS "TeacherMaterial_materialType_idx" ON "TeacherMaterial"("materialType")',
    'CREATE INDEX IF NOT EXISTS "TeacherMaterial_status_idx" ON "TeacherMaterial"("status")',
    'CREATE INDEX IF NOT EXISTS "TeacherMaterial_subject_idx" ON "TeacherMaterial"("subject")',
    'CREATE INDEX IF NOT EXISTS "TeacherMaterial_grade_idx" ON "TeacherMaterial"("grade")',
  ];
  for (const statement of indexes) {
    await prisma.$executeRawUnsafe(statement);
  }
}

function ensureContentMaterialSchemaReady() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureContentMaterialSchema().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
}

router.use(async (req, res, next) => {
  if (req.path === '/supported-subjects') return next();

  try {
    await ensureContentMaterialSchemaReady();
    return next();
  } catch (error) {
    console.error('Content material schema initialization error:', error);
    return res.status(500).json({ message: 'Failed to initialize content materials' });
  }
});

router.get('/supported-subjects', (_req, res) => {
  return res.json({
    subjects: SUPPORTED_KEY_SUBJECTS,
    guidance: SUBJECT_GUIDANCE,
    note: 'Generated practice should be labeled exam-style, past-paper-based, aligned with common exam patterns, or modeled on syllabus expectations unless official source data proves otherwise.',
  });
});

router.get('/health', async (_req, res) => {
  try {
    await ensureStudentSubscriptionSchema();
    const [contentMaterials, teacherMaterials, studentSubscription] = await Promise.all([
      prisma.contentMaterial.findMany({
        where: buildWhereFromQuery({}, 'STUDENT'),
        take: 1,
        include: { subject: true, topic: true },
      }),
      prisma.teacherMaterial.findMany({ take: 1 }),
      prisma.studentSubscription.findFirst({
        orderBy: [{ createdAt: 'desc' }],
        include: { package: true, school: true },
      }),
    ]);

    return res.json({
      success: true,
      status: 'ok',
      contentMaterialQueryReady: Array.isArray(contentMaterials),
      publishedStudentMaterialsAvailable: contentMaterials.length > 0,
      teacherMaterialQueryReady: Array.isArray(teacherMaterials),
      studentSubscriptionQueryReady: studentSubscription === null || Boolean(studentSubscription.id),
    });
  } catch (error) {
    console.error('GET /api/content-materials/health error:', error);
    return res.status(500).json({ message: 'Content materials health check failed' });
  }
});

router.post('/admin/upload', requireAdmin, materialUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File is required' });
  const fileUrl = `/uploads/${req.file.filename}`;
  logAdminAction(req, 'content_material_file_uploaded', { filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size });
  return res.status(201).json({
    message: 'File uploaded successfully',
    fileUrl,
    absoluteUrl: `${env.APP_BASE_URL}${fileUrl}`,
    fileType: req.file.mimetype === 'application/pdf' ? 'pdf' : 'image',
  });
});

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const where = {};
    const contentType = req.query.contentType ? normalizeEnum(req.query.contentType, CONTENT_TYPES, null) : null;
    const audience = req.query.audience ? normalizeEnum(req.query.audience, AUDIENCES, null) : null;
    const status = req.query.status ? normalizeEnum(req.query.status, STATUSES, null) : null;
    const qualityStatus = req.query.qualityStatus ? normalizeEnum(req.query.qualityStatus, QUALITY_STATUSES, null) : null;
    if (contentType) where.contentType = contentType;
    if (audience) where.audience = audience;
    if (status) where.status = status;
    if (qualityStatus) where.qualityStatus = qualityStatus;

    const materials = await prisma.contentMaterial.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: { subject: true, topic: true },
    });
    return res.json(materials.map((material) => serializeMaterial(material)));
  } catch (error) {
    console.error('GET /api/content-materials/admin error:', error);
    return res.status(500).json({ message: 'Failed to load content materials' });
  }
});

router.get('/admin/quality-summary', requireAdmin, async (_req, res) => {
  try {
    const [content, teacherMaterials] = await Promise.all([
      prisma.contentMaterial.groupBy({
        by: ['qualityStatus'],
        _count: { _all: true },
      }),
      prisma.teacherMaterial.groupBy({
        by: ['qualityStatus'],
        _count: { _all: true },
      }),
    ]);
    return res.json({
      content: content.map((row) => ({ qualityStatus: row.qualityStatus || 'DRAFT', count: row._count._all })),
      teacherMaterials: teacherMaterials.map((row) => ({ qualityStatus: row.qualityStatus || 'DRAFT', count: row._count._all })),
    });
  } catch (error) {
    console.error('GET /api/content-materials/admin/quality-summary error:', error);
    return res.status(500).json({ message: 'Failed to load quality summary' });
  }
});

router.post('/admin/publish-active-existing', requireAdmin, async (req, res) => {
  try {
    const result = await prisma.contentMaterial.updateMany({
      where: {
        status: 'ACTIVE',
        qualityStatus: { in: ['DRAFT', 'NEEDS_REVIEW', 'APPROVED'] },
      },
      data: { qualityStatus: 'PUBLISHED' },
    });
    logAdminAction(req, 'content_materials_bulk_published', { count: result.count });
    return res.json({ message: `${result.count} active content material(s) published`, count: result.count });
  } catch (error) {
    console.error('POST /api/content-materials/admin/publish-active-existing error:', error);
    return res.status(500).json({ message: 'Failed to publish active content materials' });
  }
});

router.post('/admin/repair-schema', requireAdmin, async (req, res) => {
  try {
    await ensureContentMaterialSchema();
    logAdminAction(req, 'content_material_schema_repaired', {});
    return res.json({ message: 'Content material schema repair completed' });
  } catch (error) {
    console.error('POST /api/content-materials/admin/repair-schema error:', error);
    return res.status(500).json({ message: 'Failed to repair content material schema', detail: error.message });
  }
});

router.patch('/admin/:id/publish', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid content material ID' });

    const material = await prisma.contentMaterial.update({
      where: { id },
      data: { status: 'ACTIVE', qualityStatus: 'PUBLISHED' },
      include: { subject: true, topic: true },
    });
    logAdminAction(req, 'content_material_published', { materialId: id });
    return res.json({ message: 'Content material published', material: serializeMaterial(material) });
  } catch (error) {
    console.error('PATCH /api/content-materials/admin/:id/publish error:', error);
    return res.status(500).json({ message: 'Failed to publish content material' });
  }
});

router.post('/admin', requireAdmin, async (req, res) => {
  try {
    const { payload, errors } = buildMaterialPayload(req.body);
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    const material = await prisma.contentMaterial.create({ data: payload, include: { subject: true, topic: true } });
    logAdminAction(req, 'content_material_created', { materialId: material.id, audience: material.audience, contentType: material.contentType });
    return res.status(201).json({ message: 'Content material created successfully', material: serializeMaterial(material) });
  } catch (error) {
    console.error('POST /api/content-materials/admin error:', error);
    return res.status(500).json({ message: 'Failed to create content material' });
  }
});

router.patch('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid content material ID' });

    const { payload, errors } = buildMaterialPayload(req.body);
    if (errors.length) return res.status(400).json({ message: 'Validation failed', errors });

    const material = await prisma.contentMaterial.update({ where: { id }, data: payload, include: { subject: true, topic: true } });
    logAdminAction(req, 'content_material_updated', { materialId: id, audience: material.audience, contentType: material.contentType });
    return res.json({ message: 'Content material updated successfully', material: serializeMaterial(material) });
  } catch (error) {
    console.error('PATCH /api/content-materials/admin/:id error:', error);
    return res.status(500).json({ message: 'Failed to update content material' });
  }
});

router.delete('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid content material ID' });

    await prisma.contentMaterial.delete({ where: { id } });
    logAdminAction(req, 'content_material_deleted', { materialId: id });
    return res.json({ message: 'Content material deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/content-materials/admin/:id error:', error);
    return res.status(500).json({ message: 'Failed to delete content material' });
  }
});

router.get('/student', requireAuth, async (req, res) => {
  try {
    if (req.user?.isAdmin) return res.json([]);
    const subscription = await getActiveStudentSubscription(req.user?.id);
    const latestSubscription = subscription || await getLatestStudentSubscription(req.user?.id);
    const materials = await prisma.contentMaterial.findMany({
      where: buildWhereFromQuery(req.query, 'STUDENT'),
      orderBy: [{ subjectName: 'asc' }, { grade: 'asc' }, { topicTitle: 'asc' }, { createdAt: 'desc' }],
      include: { subject: true, topic: true },
    });

    return res.json(materials.map((material) => {
      const canView = canViewMaterial(material, subscription);
      const canDownload = canDownloadMaterial(material, subscription);
      return serializeMaterial(material, {
        canView,
        canDownload,
        access: buildStudentAccessPayload(subscription || latestSubscription),
      });
    }));
  } catch (error) {
    console.error('GET /api/content-materials/student error:', error);
    return res.status(500).json({ message: 'Failed to load student notes' });
  }
});

router.get('/teacher', requireActiveTeacherMaterials, async (req, res) => {
  try {
    const materials = await prisma.contentMaterial.findMany({
      where: buildWhereFromQuery(req.query, 'TEACHER'),
      orderBy: [{ subjectName: 'asc' }, { grade: 'asc' }, { topicTitle: 'asc' }, { createdAt: 'desc' }],
      include: { subject: true, topic: true },
    });
    return res.json(materials.map((material) => serializeMaterial(material, { canDownload: true })));
  } catch (error) {
    console.error('GET /api/content-materials/teacher error:', error);
    return res.status(500).json({ message: 'Failed to load Teacher Materials content' });
  }
});

module.exports = router;
