const SECTION_ALIASES = {
  title: ['title'],
  objectives: ['learning objective', 'learning objectives', 'lesson objective', 'lesson objectives', 'objective', 'objectives'],
  keyConcepts: ['key concept', 'key concepts', 'key term', 'key terms', 'keywords'],
  introduction: ['introduction', 'overview'],
  explanation: ['explanation', 'main note', 'main notes', 'notes'],
  examples: ['worked example', 'worked examples', 'examples'],
  summary: ['summary', 'revision summary', 'key point', 'key points'],
  practice: ['practice question', 'practice questions', 'activity', 'activities', 'exercise'],
};

const aliasEntries = Object.entries(SECTION_ALIASES).flatMap(([key, aliases]) =>
  aliases.map((alias) => [alias, key])
);
const aliasLookup = new Map(aliasEntries);
const labelPattern = aliasEntries
  .map(([alias]) => alias)
  .sort((a, b) => b.length - a.length)
  .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function normalizeLabel(value) {
  return String(value || '')
    .replace(/^#{1,4}\s*/, '')
    .replace(/[:\-]\s*$/, '')
    .trim()
    .toLowerCase();
}

function sectionKeyForLabel(value) {
  return aliasLookup.get(normalizeLabel(value)) || null;
}

function appendSection(sections, key, value) {
  const text = String(value || '').trim();
  if (!text) return;
  sections[key] = sections[key] ? `${sections[key]}\n${text}` : text;
}

export function parseLegacyNoteContent(content) {
  const normalized = String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(new RegExp(`\\s*(${labelPattern})\\s*:\\s*`, 'gi'), '\n## $1\n')
    .trim();

  if (!normalized) return {};

  const sections = {};
  let activeKey = 'explanation';
  const buffer = [];

  const flush = () => {
    appendSection(sections, activeKey, buffer.join('\n'));
    buffer.length = 0;
  };

  normalized.split('\n').forEach((line) => {
    const trimmed = line.trim();
    const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
    const labelOnly = trimmed.match(/^([^:]{2,45}):$/);
    const nextKey = sectionKeyForLabel(heading?.[1] || labelOnly?.[1]);

    if (nextKey) {
      flush();
      activeKey = nextKey;
      return;
    }

    buffer.push(line);
  });
  flush();

  return sections;
}

export function buildStructuredNote(material = {}) {
  const legacy = parseLegacyNoteContent(material.content);
  const explicit = {
    objectives: material.learningObjectives,
    keyConcepts: material.keyConcepts,
    explanation: material.content,
    examples: material.workedExamples,
    summary: material.summary,
  };

  return {
    embeddedTitle: legacy.title || '',
    objectives: String(explicit.objectives || legacy.objectives || '').trim(),
    keyConcepts: String(explicit.keyConcepts || legacy.keyConcepts || '').trim(),
    introduction: String(legacy.introduction || '').trim(),
    explanation: String(legacy.explanation || explicit.explanation || '').trim(),
    examples: String(explicit.examples || legacy.examples || '').trim(),
    summary: String(explicit.summary || legacy.summary || '').trim(),
    practice: String(legacy.practice || '').trim(),
  };
}

export function extractStudyPoints(structuredNote = {}, limit = 6) {
  const source = [
    structuredNote.keyConcepts,
    structuredNote.objectives,
    structuredNote.summary,
    structuredNote.introduction,
    structuredNote.explanation,
  ].filter(Boolean).join('\n');

  const points = source
    .replace(/#{1,4}\s*/g, '')
    .split(/\n|;|(?:\.\s+)/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((item) => item.length >= 3 && item.length <= 110);

  return [...new Set(points)].slice(0, limit);
}
