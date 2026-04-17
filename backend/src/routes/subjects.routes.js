const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { normalizeGrade, listGradeValues } = require("../utils/normalizers");

const GRADE_RANK = {
  FORM_1: 1,
  FORM_2: 2,
  FORM_3: 3,
  FORM_4: 4,
  GRADE_10: 5,
  GRADE_11: 6,
  GRADE_12: 7,
};

function canStudentAccessGrade(studentGrade, subjectGrade) {
  const normalizedStudentGrade = normalizeGrade(studentGrade);
  const normalizedSubjectGrade = normalizeGrade(subjectGrade);

  if (!normalizedStudentGrade || !normalizedSubjectGrade) return false;

  // Form 4 and Grade 12 can access all subject levels
  if (normalizedStudentGrade === "FORM_4" || normalizedStudentGrade === "GRADE_12") {
    return true;
  }

  const studentRank = GRADE_RANK[normalizedStudentGrade];
  const subjectRank = GRADE_RANK[normalizedSubjectGrade];

  if (!studentRank || !subjectRank) return false;

  return subjectRank <= studentRank;
}

async function getAccessibleSubjectsForStudent(student, requestedGrade = null) {
  const normalizedStudentGrade = normalizeGrade(student?.grade);
  const normalizedRequestedGrade = normalizeGrade(requestedGrade);

  const subjects = await prisma.subject.findMany({
    orderBy: [{ grade: "asc" }, { id: "desc" }],
    include: { _count: { select: { topics: true, mockExams: true } } },
  });

  return subjects.filter((subject) => {
    const subjectGrade = normalizeGrade(subject.grade);

    if (!canStudentAccessGrade(normalizedStudentGrade, subjectGrade)) {
      return false;
    }

    if (normalizedRequestedGrade && subjectGrade !== normalizedRequestedGrade) {
      return false;
    }

    return true;
  });
}

async function ensureStudentCanAccessSubject(student, subjectId) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { _count: { select: { topics: true, mockExams: true } } },
  });

  if (!subject) {
    return { allowed: false, status: 404, reason: "Subject not found" };
  }

  const allowed = canStudentAccessGrade(student?.grade, subject.grade);

  if (!allowed) {
    return {
      allowed: false,
      status: 403,
      reason: "You do not have access to this subject",
    };
  }

  return { allowed: true, subject };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const grade = normalizeGrade(req.query.grade);

    if (!req.user?.isAdmin) {
      const currentStudent = req.currentStudent || req.user;
      const subjects = await getAccessibleSubjectsForStudent(currentStudent, grade);
      return res.json(subjects);
    }

    const where = grade ? { grade } : {};
    const subjects = await prisma.subject.findMany({
      where,
      orderBy: [{ grade: "asc" }, { id: "desc" }],
      include: { _count: { select: { topics: true, mockExams: true } } },
    });

    return res.json(subjects);
  } catch (error) {
    console.error("GET /api/subjects error:", error);
    return res.status(500).json({ message: "Failed to fetch subjects" });
  }
});

router.get("/:id/topics", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid subject ID" });
    }

    if (!req.user?.isAdmin) {
      const access = await ensureStudentCanAccessSubject(req.currentStudent || req.user, id);
      if (!access.allowed) {
        return res.status(access.status || 403).json({ message: access.reason });
      }
    }

    const topics = await prisma.topic.findMany({
      where: { subjectId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { _count: { select: { questions: true, quizzes: true, mockExams: true } } },
    });

    return res.json(topics);
  } catch (error) {
    console.error("GET /api/subjects/:id/topics error:", error);
    return res.status(500).json({ message: "Failed to fetch subject topics" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid subject ID" });
    }

    if (!req.user?.isAdmin) {
      const access = await ensureStudentCanAccessSubject(req.currentStudent || req.user, id);
      if (!access.allowed) {
        return res.status(access.status || 403).json({ message: access.reason });
      }
      return res.json(access.subject);
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
      include: { _count: { select: { topics: true, mockExams: true } } },
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    return res.json(subject);
  } catch (error) {
    console.error("GET /api/subjects/:id error:", error);
    return res.status(500).json({ message: "Failed to fetch subject" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, grade, description, accessPlan } = req.body;
    const trimmedName = String(name || "").trim();
    const normalizedGrade = normalizeGrade(grade);
    const normalizedAccessPlan = String(accessPlan || "").trim() || "Free";

    if (!trimmedName || !normalizedGrade) {
      return res.status(400).json({
        message: `Subject name and a valid grade are required. Allowed grades: ${listGradeValues().join(", ")}`,
      });
    }

    const existing = await prisma.subject.findUnique({
      where: { name_grade: { name: trimmedName, grade: normalizedGrade } },
    });

    if (existing) {
      return res.status(409).json({ message: "Subject already exists for this grade" });
    }

    const subject = await prisma.subject.create({
      data: {
        name: trimmedName,
        description: description ? String(description).trim() : null,
        grade: normalizedGrade,
        accessPlan: normalizedAccessPlan,
      },
      include: { _count: { select: { topics: true, mockExams: true } } },
    });

    return res.status(201).json({ message: "Subject created successfully", subject });
  } catch (error) {
    console.error("POST /api/subjects error:", error);
    return res.status(500).json({ message: "Failed to create subject" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, grade, description, accessPlan } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid subject ID" });
    }

    const trimmedName = String(name || "").trim();
    const normalizedGrade = normalizeGrade(grade);
    const normalizedAccessPlan = String(accessPlan || "").trim() || "Free";

    if (!trimmedName || !normalizedGrade) {
      return res.status(400).json({
        message: `Subject name and a valid grade are required. Allowed grades: ${listGradeValues().join(", ")}`,
      });
    }

    const existing = await prisma.subject.findFirst({
      where: {
        name: trimmedName,
        grade: normalizedGrade,
        NOT: { id },
      },
    });

    if (existing) {
      return res.status(409).json({ message: "Another subject with this name already exists for this grade" });
    }

    const subject = await prisma.subject.update({
      where: { id },
      data: {
        name: trimmedName,
        description: description ? String(description).trim() : null,
        grade: normalizedGrade,
        accessPlan: normalizedAccessPlan,
      },
      include: { _count: { select: { topics: true, mockExams: true } } },
    });

    return res.json({ message: "Subject updated successfully", subject });
  } catch (error) {
    console.error("PUT /api/subjects/:id error:", error);
    return res.status(500).json({ message: "Failed to update subject" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid subject ID" });
    }

    const existing = await prisma.subject.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Subject not found" });
    }

    await prisma.subject.delete({ where: { id } });
    return res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/subjects/:id error:", error);
    return res.status(500).json({ message: "Failed to delete subject" });
  }
});

module.exports = router;