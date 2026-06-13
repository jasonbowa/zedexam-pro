import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStructuredNote, extractStudyPoints, parseLegacyNoteContent } from './noteSections.js';

test('splits inline legacy labels into structured note sections', () => {
  const parsed = parseLegacyNoteContent(
    'Title: Photosynthesis Objectives: Define photosynthesis. Key Concepts: Chlorophyll; sunlight Notes: Plants make food using light. Worked Example: Explain why leaves are green. Summary: Light energy becomes chemical energy.'
  );

  assert.equal(parsed.title, 'Photosynthesis');
  assert.equal(parsed.objectives, 'Define photosynthesis.');
  assert.equal(parsed.keyConcepts, 'Chlorophyll; sunlight');
  assert.equal(parsed.explanation, 'Plants make food using light.');
  assert.equal(parsed.examples, 'Explain why leaves are green.');
  assert.equal(parsed.summary, 'Light energy becomes chemical energy.');
});

test('prefers explicit fields while preserving legacy sections', () => {
  const structured = buildStructuredNote({
    content: 'Introduction: Start here. Notes: Legacy explanation.',
    learningObjectives: '- Identify the main idea',
    keyConcepts: '- Main idea',
    workedExamples: 'A worked example',
    summary: 'A short summary',
  });

  assert.equal(structured.objectives, '- Identify the main idea');
  assert.equal(structured.explanation, 'Legacy explanation.');
  assert.equal(structured.examples, 'A worked example');
});

test('extracts concise points for a visual topic map', () => {
  const points = extractStudyPoints({
    keyConcepts: '- Chlorophyll\n- Sunlight\n- Carbon dioxide',
    objectives: '- Explain glucose production',
  });

  assert.deepEqual(points.slice(0, 4), ['Chlorophyll', 'Sunlight', 'Carbon dioxide', 'Explain glucose production']);
});
