const { GradeLevel, QuestionType } = require('@prisma/client');

const gradeAliases = {
  'FORM 1': GradeLevel.FORM_1,
  FORM1: GradeLevel.FORM_1,
  FORM_1: GradeLevel.FORM_1,
  'FORM-1': GradeLevel.FORM_1,
  '1': GradeLevel.FORM_1,
  'FORM 2': GradeLevel.FORM_2,
  FORM2: GradeLevel.FORM_2,
  FORM_2: GradeLevel.FORM_2,
  'FORM-2': GradeLevel.FORM_2,
  '2': GradeLevel.FORM_2,
  'FORM 3': GradeLevel.FORM_3,
  FORM3: GradeLevel.FORM_3,
  FORM_3: GradeLevel.FORM_3,
  'FORM-3': GradeLevel.FORM_3,
  '3': GradeLevel.FORM_3,
  'FORM 4': GradeLevel.FORM_4,
  FORM4: GradeLevel.FORM_4,
  FORM_4: GradeLevel.FORM_4,
  'FORM-4': GradeLevel.FORM_4,
  '4': GradeLevel.FORM_4,
  'GRADE 10': GradeLevel.GRADE_10,
  GRADE10: GradeLevel.GRADE_10,
  GRADE_10: GradeLevel.GRADE_10,
  'GRADE-10': GradeLevel.GRADE_10,
  '10': GradeLevel.GRADE_10,
  'GRADE 11': GradeLevel.GRADE_11,
  GRADE11: GradeLevel.GRADE_11,
  GRADE_11: GradeLevel.GRADE_11,
  'GRADE-11': GradeLevel.GRADE_11,
  '11': GradeLevel.GRADE_11,
  'GRADE 12': GradeLevel.GRADE_12,
  GRADE12: GradeLevel.GRADE_12,
  GRADE_12: GradeLevel.GRADE_12,
  'GRADE-12': GradeLevel.GRADE_12,
  '12': GradeLevel.GRADE_12,
};

function normalizeGrade(value) {
  if (value === undefined || value === null || value === '') return null;
  const key = String(value).trim().toUpperCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  const compact = key.replace(/\s+/g, '');
  return gradeAliases[key] || gradeAliases[compact] || null;
}

function listGradeValues() {
  return [...new Set(Object.values(GradeLevel))];
}

function normalizeQuestionType(value) {
  if (!value) return QuestionType.MCQ;
  const candidate = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return Object.values(QuestionType).includes(candidate) ? candidate : QuestionType.MCQ;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function normalizePhoneNumber(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let normalized = raw.replace(/[^\d+]/g, '');

  if (normalized.startsWith('+260')) {
    normalized = `0${normalized.slice(4)}`;
  } else if (normalized.startsWith('260') && normalized.length === 12) {
    normalized = `0${normalized.slice(3)}`;
  } else if (/^9\d{8}$/.test(normalized)) {
    normalized = `0${normalized}`;
  }

  normalized = normalized.replace(/\s+/g, '');
  return normalized || null;
}

function isValidStudentPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);
  return /^0\d{9}$/.test(String(normalized || ''));
}

function buildStudentLoginCandidates(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const email = normalizeEmail(raw);
  if (email && email.includes('@')) {
    return [email];
  }

  const normalizedPhone = normalizePhoneNumber(raw);
  const cleanedDigits = raw.replace(/[^\d]/g, '');

  return Array.from(
    new Set([
      raw,
      normalizedPhone,
      cleanedDigits || null,
      cleanedDigits ? `0${cleanedDigits.replace(/^0+/, '')}` : null,
    ].filter(Boolean))
  );
}

module.exports = {
  normalizeGrade,
  listGradeValues,
  normalizeQuestionType,
  normalizeEmail,
  normalizePhoneNumber,
  isValidStudentPhoneNumber,
  buildStudentLoginCandidates,
};
