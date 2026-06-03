const SUPPORTED_KEY_SUBJECTS = [
  'Mathematics',
  'Biology',
  'Chemistry',
  'Physics',
  'English',
  'Computer Studies / ICT',
  'Principles of Accounts',
  'Commerce',
  'History',
  'Civic Education',
];

const SUBJECT_GUIDANCE = {
  Mathematics: 'Use graphs, geometry diagrams, charts, number lines, worked examples, and exam-style calculations where useful.',
  Biology: 'Use labelled biological diagrams, clear processes, definitions, and common learner mistakes.',
  Chemistry: 'Use apparatus diagrams, equations, reaction schemes, tables, and structured explanations.',
  Physics: 'Use circuit diagrams, ray diagrams, force diagrams, graphs, formula work, and units.',
  English: 'Use passages, comprehension questions, grammar examples, essay plans, literature notes, and marking guidance.',
  'Computer Studies / ICT': 'Use screenshots, flowcharts, algorithms, tables, system diagrams, and practical examples.',
  'Principles of Accounts': 'Use ledger formats, trial balance tables, financial statements, and worked calculations.',
  Commerce: 'Use business documents, trade flow diagrams, tables, and case-study questions.',
  History: 'Use timelines, source-based questions, maps where useful, essay plans, and evidence-based explanations.',
  'Civic Education': 'Use structured notes, case studies, rights/responsibility charts, governance diagrams, and essay-style answers.',
};

module.exports = {
  SUPPORTED_KEY_SUBJECTS,
  SUBJECT_GUIDANCE,
};
