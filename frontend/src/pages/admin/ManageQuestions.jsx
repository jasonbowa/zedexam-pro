import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_ROOT, authFetch, clearAuth, getStoredUser } from '../../api';

const QUESTION_TYPES = [
  { value: 'MCQ', label: 'Multiple Choice' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'STRUCTURED', label: 'Structured' },
  { value: 'PASSAGE_BASED', label: 'Passage Based' },
  { value: 'IMAGE_BASED', label: 'Image Based' },
];
function initialForm() {
  return {
    questionType: 'MCQ',
    question: '',
    passage: '',
    imageUrl: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    answerText: '',
    explanation: '',
    marks: 1,
    difficulty: '',
  };
}

function buildQuestionPayload(form, topicId) {
  const questionType = form.questionType || 'MCQ';
  const payload = {
    topicId: Number(topicId),
    questionType,
    question: form.question.trim(),
    passage: '',
    imageUrl: '',
    optionA: null,
    optionB: null,
    optionC: null,
    optionD: null,
    correctAnswer: null,
    answerText: null,
    explanation: form.explanation.trim() || null,
    difficulty: form.difficulty.trim() || null,
    marks: Number(form.marks) > 0 ? Number(form.marks) : 1,
  };

  if (questionType === 'PASSAGE_BASED') payload.passage = form.passage.trim();
  if (questionType === 'IMAGE_BASED') payload.imageUrl = form.imageUrl.trim();

  if (['MCQ', 'PASSAGE_BASED', 'IMAGE_BASED'].includes(questionType)) {
    payload.optionA = form.optionA.trim();
    payload.optionB = form.optionB.trim();
    payload.optionC = form.optionC.trim();
    payload.optionD = form.optionD.trim();

    const optionMap = { A: payload.optionA, B: payload.optionB, C: payload.optionC, D: payload.optionD };
    const rawAnswer = form.correctAnswer.trim();
    const upper = rawAnswer.toUpperCase();
    payload.correctAnswer = optionMap[upper] || rawAnswer;
  }

  if (['SHORT_ANSWER', 'STRUCTURED'].includes(questionType)) {
    const answer = form.answerText.trim() || form.correctAnswer.trim();
    payload.answerText = answer || null;
    payload.correctAnswer = answer || null;
  }

  return payload;
}

function normalizeFormByQuestionType(currentForm, nextType) {
  const next = { ...currentForm, questionType: nextType };

  if (!['MCQ', 'PASSAGE_BASED', 'IMAGE_BASED'].includes(nextType)) {
    next.optionA = '';
    next.optionB = '';
    next.optionC = '';
    next.optionD = '';
  }

  if (!['SHORT_ANSWER', 'STRUCTURED'].includes(nextType)) next.answerText = '';
  if (nextType !== 'PASSAGE_BASED') next.passage = '';
  if (nextType !== 'IMAGE_BASED') next.imageUrl = '';

  if (['SHORT_ANSWER', 'STRUCTURED'].includes(nextType)) {
    next.correctAnswer = next.answerText || next.correctAnswer;
  } else {
    next.answerText = '';
  }

  return next;
}

export default function ManageQuestions() {
  const navigate = useNavigate();
  useMemo(() => getStoredUser(), []);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [form, setForm] = useState(initialForm());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => {
    if (subjectId) fetchTopicsBySubject(subjectId);
    else {
      setTopics([]);
      setTopicId('');
    }
  }, [subjectId]);
  useEffect(() => { fetchQuestions(); }, [topicId]);

  const setField = (key, value) => {
    if (key === 'questionType') {
      setForm((prev) => normalizeFormByQuestionType(prev, value));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const subjectsData = await authFetch('/subjects');
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
    } catch (err) {
      setError(err.message || 'Failed to load subjects.');
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicsBySubject = async (selectedSubjectId) => {
    try {
      let data;
      try {
        data = await authFetch(`/subjects/${selectedSubjectId}/topics`);
      } catch {
        data = await authFetch('/topics');
        data = Array.isArray(data)
          ? data.filter((topic) => String(topic.subjectId || topic.subject?.id || '') === String(selectedSubjectId))
          : [];
      }
      setTopics(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load topics.');
      setTopics([]);
    }
  };

  const fetchQuestions = async () => {
    setError('');
    try {
      const data = topicId ? await authFetch(`/questions/topic/${topicId}`) : await authFetch('/questions');
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load questions.');
      setQuestions([]);
    }
  };

  const resetForm = () => {
    setForm(initialForm());
    setEditingId(null);
  };

  const validateForm = () => {
    if (!topicId) return 'Please select a topic.';
    if (!form.question.trim()) return 'Question text is required.';

    if (['MCQ', 'PASSAGE_BASED', 'IMAGE_BASED'].includes(form.questionType)) {
      if (![form.optionA, form.optionB, form.optionC, form.optionD].every((value) => String(value || '').trim())) {
        return 'All four options are required for this question type.';
      }
      if (!form.correctAnswer.trim()) return 'Correct answer is required.';
    }

    if (['SHORT_ANSWER', 'STRUCTURED'].includes(form.questionType)) {
      if (!form.answerText.trim() && !form.correctAnswer.trim()) {
        return 'Provide the expected answer for this question.';
      }
    }

    if (form.questionType === 'PASSAGE_BASED' && !form.passage.trim()) return 'Passage is required for passage-based questions.';
    if (form.questionType === 'IMAGE_BASED' && !form.imageUrl.trim()) return 'Upload or provide an image URL for image-based questions.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = buildQuestionPayload(form, topicId);
      if (editingId) {
        await authFetch(`/questions/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        setSuccess('Question updated successfully.');
      } else {
        await authFetch('/questions', { method: 'POST', body: JSON.stringify(payload) });
        setSuccess('Question created successfully.');
      }
      resetForm();
      fetchQuestions();
    } catch (err) {
      setError(err.message || 'Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('zedexam_token');
      const fd = new FormData();
      fd.append('image', file);

      const res = await fetch(`${API_ROOT}/api/questions/upload-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Image upload failed');
      setField('imageUrl', data.imageUrl || '');
      setSuccess('Image uploaded successfully.');
    } catch (err) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (question) => {
    setEditingId(question.id);
    setSubjectId(String(question.topic?.subjectId || question.topic?.subject?.id || ''));
    setTopicId(String(question.topicId || question.topic?.id || ''));
    setForm({
      questionType: question.questionType || 'MCQ',
      question: question.question || '',
      passage: question.passage || '',
      imageUrl: question.imageUrl || '',
      optionA: question.optionA || '',
      optionB: question.optionB || '',
      optionC: question.optionC || '',
      optionD: question.optionD || '',
      correctAnswer: question.correctAnswer || question.answerText || '',
      answerText: question.answerText || '',
      explanation: question.explanation || '',
      marks: question.marks || 1,
      difficulty: question.difficulty || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await authFetch(`/questions/${id}`, { method: 'DELETE' });
      setSuccess('Question deleted successfully.');
      fetchQuestions();
    } catch (err) {
      setError(err.message || 'Failed to delete question.');
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  const selectedTopicName = topics.find((topic) => String(topic.id) === String(topicId))?.title || '';
  const imagePreviewUrl = form.imageUrl ? (form.imageUrl.startsWith('http') ? form.imageUrl : `${API_ROOT}${form.imageUrl}`) : '';
  const typeHelp = {
    MCQ: 'Use four options and set the correct answer to the exact option text or letter A-D.',
    SHORT_ANSWER: 'Use the expected learner response. Options are not needed.',
    STRUCTURED: 'Use model marking-point text or a concise expected answer.',
    PASSAGE_BASED: 'Provide a passage plus four answer options.',
    IMAGE_BASED: 'Upload a diagram or image, then provide four answer options.',
  };

  return (
    <div style={page}>
      <header style={header}>
        <div style={headerInner}>
          <div>
            <div style={eyebrow}>ZedExam Pro Admin</div>
            <h1 style={heroTitle}>Manage Questions</h1>
            <p style={heroText}>Create polished MCQ, short-answer, structured, passage-based, and image-based questions from one place.</p>
          </div>

          <div style={headerActions}>
            <Link to="/admin" style={navBtn('rgba(255,255,255,0.18)', '#fff')}>Dashboard</Link>
            <Link to="/admin/bulk-upload" style={navBtn('#dbeafe', '#1d4ed8')}>Bulk Upload</Link>
            <button onClick={handleLogout} style={navBtn('#0f172a', '#fff')}>Logout</button>
          </div>
        </div>
      </header>

      <main style={main}>
        {error ? <Alert type="error" message={error} /> : null}
        {success ? <Alert type="success" message={success} /> : null}

        <section style={panel}>
          <div style={panelTitleRow}>
            <div>
              <h2 style={panelTitle}>{editingId ? 'Edit Question' : 'Add New Question'}</h2>
              <p style={panelSubtext}>{typeHelp[form.questionType]}</p>
            </div>
            <div style={badge}>{QUESTION_TYPES.find((item) => item.value === form.questionType)?.label}</div>
          </div>

          <form onSubmit={handleSubmit} style={formGrid}>
            <div style={grid2}>
              <Select label="Subject" value={subjectId} onChange={(value) => { setSubjectId(value); setTopicId(''); }} options={subjects.map((s) => ({ value: s.id, label: s.name }))} disabled={loading} />
              <Select label="Topic" value={topicId} onChange={setTopicId} options={topics.map((t) => ({ value: t.id, label: t.title || t.name }))} disabled={!subjectId} />
            </div>

            <div style={grid3}>
              <Select label="Question Type" value={form.questionType} onChange={(value) => setField('questionType', value)} options={QUESTION_TYPES} />
              <TextInput label="Difficulty" value={form.difficulty} onChange={(value) => setField('difficulty', value)} placeholder="easy / medium / hard" />
              <TextInput label="Marks" type="number" value={String(form.marks)} onChange={(value) => setField('marks', value)} />
            </div>

            <TextArea label="Question Text" value={form.question} onChange={(value) => setField('question', value)} placeholder="Enter the full question exactly as students should see it." rows={5} />

            {form.questionType === 'PASSAGE_BASED' ? <TextArea label="Passage / Scenario" value={form.passage} onChange={(value) => setField('passage', value)} placeholder="Enter the reading passage or scenario here." rows={6} /> : null}

            {form.questionType === 'IMAGE_BASED' ? (
              <div style={grid2}>
                <TextInput label="Image URL" value={form.imageUrl} onChange={(value) => setField('imageUrl', value)} placeholder="/uploads/example.png or https://..." />
                <div>
                  <label style={label}>Upload Diagram / Image</label>
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e.target.files?.[0])} style={input} />
                  <div style={helperText}>{uploading ? 'Uploading image...' : 'PNG, JPG, WEBP, and GIF supported.'}</div>
                </div>
              </div>
            ) : null}

            {imagePreviewUrl ? <img src={imagePreviewUrl} alt="Preview" style={imagePreview} /> : null}

            {['MCQ', 'PASSAGE_BASED', 'IMAGE_BASED'].includes(form.questionType) ? (
              <>
                <div style={grid2}>
                  <TextInput label="Option A" value={form.optionA} onChange={(value) => setField('optionA', value)} />
                  <TextInput label="Option B" value={form.optionB} onChange={(value) => setField('optionB', value)} />
                  <TextInput label="Option C" value={form.optionC} onChange={(value) => setField('optionC', value)} />
                  <TextInput label="Option D" value={form.optionD} onChange={(value) => setField('optionD', value)} />
                </div>
                <TextInput label="Correct Answer" value={form.correctAnswer} onChange={(value) => setField('correctAnswer', value)} placeholder="Type A, B, C, D or paste the exact correct option text" />
              </>
            ) : (
              <TextArea
                label={form.questionType === 'STRUCTURED' ? 'Model Answer / Marking Points' : 'Expected Answer'}
                value={form.answerText}
                onChange={(value) => { setField('answerText', value); setField('correctAnswer', value); }}
                placeholder={form.questionType === 'STRUCTURED' ? 'Enter the expected structured response or marking guide.' : 'Enter the expected answer.'}
                rows={5}
              />
            )}

            <TextArea label="Explanation" value={form.explanation} onChange={(value) => setField('explanation', value)} placeholder="Optional teaching note or explanation." rows={4} />

            <div style={buttonRow}>
              <button type="submit" style={primaryButton} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Question' : 'Create Question'}</button>
              <button type="button" style={secondaryButton} onClick={resetForm}>Reset</button>
            </div>
          </form>

          {selectedTopicName ? <p style={topicNote}>Selected topic: <strong>{selectedTopicName}</strong></p> : null}
        </section>

        <section style={{ ...panel, marginTop: 22 }}>
          <div style={panelTitleRow}>
            <div>
              <h2 style={panelTitle}>Question Bank</h2>
              <p style={panelSubtext}>{topicId ? 'Showing questions for the selected topic.' : 'Showing all available questions.'}</p>
            </div>
            <div style={pillCount}>{questions.length} question{questions.length === 1 ? '' : 's'}</div>
          </div>

          {questions.length === 0 ? (
            <div style={emptyState}>No questions found yet.</div>
          ) : questions.map((question) => (
            <div key={question.id} style={questionCard}>
              <div style={questionTop}>
                <div>
                  <div style={typeBadge}>{String(question.questionType || 'MCQ').replace(/_/g, ' ')}</div>
                  <div style={questionText}>{question.question}</div>
                  {question.passage ? <div style={metaBlock}><strong>Passage:</strong> {question.passage}</div> : null}
                  {question.imageUrl ? <img src={question.imageUrl.startsWith('http') ? question.imageUrl : `${API_ROOT}${question.imageUrl}`} alt="Question" style={questionImage} /> : null}
                  {question.optionA ? <ul style={optionList}><li>A. {question.optionA}</li><li>B. {question.optionB}</li><li>C. {question.optionC}</li><li>D. {question.optionD}</li></ul> : null}
                  {question.correctAnswer ? <div style={metaBlock}><strong>Correct:</strong> {question.correctAnswer}</div> : null}
                  {question.answerText ? <div style={metaBlock}><strong>Answer text:</strong> {question.answerText}</div> : null}
                </div>
                <div style={cardActions}>
                  <button onClick={() => handleEdit(question)} style={secondaryButton}>Edit</button>
                  <button onClick={() => handleDelete(question.id)} style={dangerButton}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

function TextInput({ label: text, value, onChange, placeholder = '', type = 'text' }) {
  return <div><label style={label}>{text}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={input} /></div>;
}
function TextArea({ label: text, value, onChange, placeholder = '', rows = 5 }) {
  return <div><label style={label}>{text}</label><textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...input, minHeight: rows * 28, resize: 'vertical' }} /></div>;
}
function Select({ label: text, value, onChange, options, disabled = false }) {
  return <div><label style={label}>{text}</label><select value={value} onChange={(e) => onChange(e.target.value)} style={input} disabled={disabled}><option value="">Select {text}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
function Alert({ type, message }) { return <div style={{ marginBottom: 18, padding: 15, borderRadius: 18, color: type === 'error' ? '#991b1b' : '#065f46', background: type === 'error' ? '#fee2e2' : '#d1fae5', border: `1px solid ${type === 'error' ? '#fecaca' : '#a7f3d0'}`, boxShadow: '0 10px 30px rgba(15,23,42,0.05)' }}>{message}</div>; }
const page = { minHeight: '100vh', background: 'linear-gradient(180deg, #f8fbff 0%, #eef4ff 30%, #f8fafc 100%)', fontFamily: '"Inter", system-ui, sans-serif' };
const header = { background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)', color: '#ffffff', padding: '26px 20px', boxShadow: '0 18px 50px rgba(15,23,42,0.22)' };
const headerInner = { maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' };
const eyebrow = { display: 'inline-flex', padding: '8px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' };
const heroTitle = { margin: '14px 0 8px', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' };
const heroText = { margin: 0, maxWidth: 720, color: 'rgba(255,255,255,0.86)', lineHeight: 1.7, fontSize: 15 };
const headerActions = { display: 'flex', gap: 10, flexWrap: 'wrap' };
const main = { maxWidth: '1280px', margin: '0 auto', padding: 20 };
const panel = { background: 'rgba(255,255,255,0.95)', borderRadius: 28, padding: 22, border: '1px solid rgba(148,163,184,0.22)', boxShadow: '0 24px 60px rgba(15,23,42,0.08)', backdropFilter: 'blur(8px)' };
const panelTitleRow = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 };
const panelTitle = { margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' };
const panelSubtext = { margin: '6px 0 0', color: '#475569', lineHeight: 1.7 };
const badge = { display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: 13 };
const pillCount = { display: 'inline-flex', alignItems: 'center', padding: '10px 14px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 13 };
const formGrid = { display: 'grid', gap: 14 };
const grid2 = { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' };
const grid3 = { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' };
const label = { display: 'block', fontWeight: 700, marginBottom: 7, color: '#0f172a' };
const helperText = { fontSize: 12, color: '#64748b', marginTop: 8 };
const input = { width: '100%', borderRadius: 18, border: '1px solid #cbd5e1', padding: '13px 15px', fontSize: 14, background: '#fff', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.03)' };
const imagePreview = { maxWidth: '360px', borderRadius: 18, border: '1px solid #cbd5e1', padding: 10, background: '#fff', boxShadow: '0 12px 26px rgba(15,23,42,0.08)' };
const buttonRow = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const primaryButton = { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', border: 'none', borderRadius: 16, padding: '13px 18px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 12px 28px rgba(37,99,235,0.26)' };
const secondaryButton = { background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: 16, padding: '13px 18px', fontWeight: 700, cursor: 'pointer' };
const dangerButton = { background: '#dc2626', color: '#fff', border: 'none', borderRadius: 16, padding: '12px 16px', fontWeight: 700, cursor: 'pointer' };
const topicNote = { marginTop: 14, color: '#334155' };
const emptyState = { padding: '28px 18px', borderRadius: 22, background: '#f8fafc', color: '#475569', border: '1px dashed #cbd5e1' };
const questionCard = { border: '1px solid #e2e8f0', borderRadius: 22, padding: 18, marginBottom: 14, background: '#fff', boxShadow: '0 12px 30px rgba(15,23,42,0.04)' };
const questionTop = { display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' };
const typeBadge = { fontSize: 12, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.12em' };
const questionText = { fontSize: 17, fontWeight: 800, marginTop: 8, lineHeight: 1.6, color: '#0f172a' };
const metaBlock = { marginTop: 10, color: '#475569', lineHeight: 1.7 };
const questionImage = { maxWidth: 260, borderRadius: 14, marginTop: 12, border: '1px solid #cbd5e1' };
const optionList = { marginTop: 12, paddingLeft: 18, color: '#334155', lineHeight: 1.8 };
const cardActions = { display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' };
const navBtn = (bg, color) => ({ background: bg, color, border: 'none', borderRadius: 14, padding: '12px 16px', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', cursor: 'pointer' });
