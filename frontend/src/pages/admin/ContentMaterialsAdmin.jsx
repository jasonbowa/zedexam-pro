import { useEffect, useMemo, useState } from 'react';
import PageShell from '../../components/PageShell';
import { API_ROOT, authFetch } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../../components/ui';
import { FormInput, FormSelect, FormTextarea, PrimaryButton } from '../../components/forms';
import MarkdownText from '../../components/MarkdownText';

const blankMaterial = {
  title: '',
  subjectId: '',
  topicId: '',
  subjectName: '',
  grade: '',
  topicTitle: '',
  contentType: 'NOTE',
  audience: 'STUDENT',
  accessLevel: 'FREE',
  content: '',
  learningObjectives: '',
  keyConcepts: '',
  workedExamples: '',
  summary: '',
  imageUrl: '',
  diagramCaption: '',
  pdfUrl: '',
  teacherGuidePdfUrl: '',
  commonMistakes: '',
  examStyleGuidance: '',
  answersAndExplanations: '',
  status: 'ACTIVE',
  qualityStatus: 'DRAFT',
};

const contentTypes = [
  ['NOTE', 'Online Note'],
  ['PDF_NOTE', 'PDF Note'],
  ['TEACHER_NOTE', 'Teacher Note'],
  ['TEACHER_GUIDE', 'Teacher Guide'],
  ['DOWNLOAD', 'Downloadable Material'],
  ['PRACTICE', 'Practice Questions'],
  ['MOCK_SUPPORT', 'Mock Exam Support'],
];

const audienceOptions = [
  ['STUDENT', 'Student material'],
  ['TEACHER', 'Teacher material'],
  ['BOTH', 'Student and teacher'],
];

const qualityOptions = [
  ['DRAFT', 'Draft'],
  ['NEEDS_REVIEW', 'Needs Review'],
  ['APPROVED', 'Approved'],
  ['PUBLISHED', 'Published'],
];

export default function ContentMaterialsAdmin() {
  const [materials, setMaterials] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [supportedSubjects, setSupportedSubjects] = useState([]);
  const [guidance, setGuidance] = useState({});
  const [qualitySummary, setQualitySummary] = useState(null);
  const [form, setForm] = useState(blankMaterial);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedSubject = useMemo(
    () => subjects.find((subject) => String(subject.id) === String(form.subjectId)),
    [subjects, form.subjectId]
  );
  const selectedTopic = useMemo(
    () => topics.find((topic) => String(topic.id) === String(form.topicId)),
    [topics, form.topicId]
  );

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [materialData, subjectData, supportedData, qualityData] = await Promise.all([
        authFetch('/content-materials/admin'),
        authFetch('/subjects'),
        authFetch('/content-materials/supported-subjects'),
        authFetch('/content-materials/admin/quality-summary'),
      ]);
      setMaterials(Array.isArray(materialData) ? materialData : []);
      setSubjects(Array.isArray(subjectData) ? subjectData : []);
      setSupportedSubjects(Array.isArray(supportedData?.subjects) ? supportedData.subjects : []);
      setGuidance(supportedData?.guidance || {});
      setQualitySummary(qualityData || null);
    } catch (err) {
      setError(err.message || 'Failed to load content material workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const loadTopics = async () => {
      if (!form.subjectId) {
        setTopics([]);
        return;
      }
      try {
        const data = await authFetch(`/subjects/${form.subjectId}/topics`);
        setTopics(Array.isArray(data) ? data : []);
      } catch {
        setTopics([]);
      }
    };
    loadTopics();
  }, [form.subjectId]);

  useEffect(() => {
    if (!selectedSubject) return;
    setForm((prev) => ({
      ...prev,
      subjectName: prev.subjectName || selectedSubject.name || '',
      grade: prev.grade || String(selectedSubject.grade || '').replace(/_/g, ' '),
    }));
  }, [selectedSubject]);

  useEffect(() => {
    if (!selectedTopic) return;
    setForm((prev) => ({ ...prev, topicTitle: prev.topicTitle || selectedTopic.title || selectedTopic.name || '' }));
  }, [selectedTopic]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm(blankMaterial);
    setEditingId(null);
  };

  const uploadFile = async (file, targetField) => {
    if (!file) return;
    setUploading(targetField);
    setError('');
    try {
      const token = localStorage.getItem('zedexam_token') || localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      const response = await fetch(`${API_ROOT}/api/content-materials/admin/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Upload failed');
      updateField(targetField, data.fileUrl || '');
      setMessage('File uploaded successfully.');
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading('');
    }
  };

  const saveMaterial = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await authFetch(editingId ? `/content-materials/admin/${editingId}` : '/content-materials/admin', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          subjectId: form.subjectId || null,
          topicId: form.topicId || null,
        }),
      });
      setMessage(editingId ? 'Content material updated.' : 'Content material created.');
      resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to save content material.');
    } finally {
      setSaving(false);
    }
  };

  const editMaterial = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      subjectId: item.subjectId || '',
      topicId: item.topicId || '',
      subjectName: item.subjectName || item.subject || '',
      grade: item.grade || '',
      topicTitle: item.topicTitle || item.topic || '',
      contentType: item.contentType || 'NOTE',
      audience: item.audience || 'STUDENT',
      accessLevel: item.accessLevel || 'FREE',
      content: item.content || '',
      learningObjectives: item.learningObjectives || '',
      keyConcepts: item.keyConcepts || '',
      workedExamples: item.workedExamples || '',
      summary: item.summary || '',
      imageUrl: item.imageUrl || '',
      diagramCaption: item.diagramCaption || '',
      pdfUrl: item.pdfUrl || '',
      teacherGuidePdfUrl: item.teacherGuidePdfUrl || '',
      commonMistakes: item.commonMistakes || '',
      examStyleGuidance: item.examStyleGuidance || '',
      answersAndExplanations: item.answersAndExplanations || '',
      status: item.status || 'ACTIVE',
      qualityStatus: item.qualityStatus || 'DRAFT',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm('Delete this content material?')) return;
    setError('');
    setMessage('');
    try {
      await authFetch(`/content-materials/admin/${id}`, { method: 'DELETE' });
      setMessage('Content material deleted.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete content material.');
    }
  };

  const publishMaterial = async (id) => {
    setError('');
    setMessage('');
    try {
      await authFetch(`/content-materials/admin/${id}/publish`, { method: 'PATCH', body: JSON.stringify({}) });
      setMessage('Content material published.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to publish content material.');
    }
  };

  const publishActiveExisting = async () => {
    if (!window.confirm('Publish all active content materials that are still Draft, Needs Review, or Approved?')) return;
    setError('');
    setMessage('');
    try {
      const data = await authFetch('/content-materials/admin/publish-active-existing', { method: 'POST', body: JSON.stringify({}) });
      setMessage(data.message || 'Active content materials published.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to publish active content materials.');
    }
  };

  const subjectGuidance = guidance[form.subjectName] || guidance[selectedSubject?.name] || '';

  return (
    <PageShell title="Notes and Materials" subtitle="Manage online notes, diagrams, PDFs, teacher guides, practice support, and package access.">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <SectionCard title="Supported Key Subjects" subtitle="ZedExam Pro should support science, mathematics, business, English, and humanities content.">
        <div className="flex flex-wrap gap-2">
          {supportedSubjects.map((subject) => (
            <span key={subject} className="badge badge-info">{subject}</span>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Content Quality Safeguard"
        subtitle="Draft materials stay hidden from students and teachers until published."
        action={<button className="btn btn-secondary" onClick={publishActiveExisting}>Publish Active Existing</button>}
      >
        <div className="flex flex-wrap gap-2">
          {(qualitySummary?.content || []).map((item) => (
            <span key={item.qualityStatus} className={item.qualityStatus === 'PUBLISHED' ? 'badge badge-success' : 'badge badge-warning'}>
              {item.qualityStatus}: {item.count}
            </span>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <SectionCard title={editingId ? 'Edit Content Material' : 'Create Content Material'} subtitle="Use online text first; attach diagrams and PDF downloads only where useful.">
          <form className="grid gap-4" onSubmit={saveMaterial}>
            <FormInput label="Title" value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="e.g. Trial Balance worked example" />

            <div className="grid gap-4 md:grid-cols-4">
              <FormSelect label="Content Type" value={form.contentType} onChange={(event) => updateField('contentType', event.target.value)}>
                {contentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </FormSelect>
              <FormSelect label="Audience" value={form.audience} onChange={(event) => updateField('audience', event.target.value)}>
                {audienceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </FormSelect>
              <FormSelect label="Status" value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="INACTIVE">Inactive</option>
              </FormSelect>
              <FormSelect label="Quality Status" value={form.qualityStatus} onChange={(event) => updateField('qualityStatus', event.target.value)}>
                {qualityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </FormSelect>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormSelect label="Linked Subject" value={form.subjectId} onChange={(event) => updateField('subjectId', event.target.value)}>
                <option value="">No linked subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name} / {String(subject.grade || '').replace(/_/g, ' ')}</option>
                ))}
              </FormSelect>
              <FormSelect label="Linked Topic" value={form.topicId} onChange={(event) => updateField('topicId', event.target.value)} disabled={!form.subjectId}>
                <option value="">No linked topic</option>
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title || topic.name}</option>)}
              </FormSelect>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormInput label="Subject Name" value={form.subjectName} onChange={(event) => updateField('subjectName', event.target.value)} placeholder="Mathematics, Commerce, Civic Education..." />
              <FormInput label="Grade/Form" value={form.grade} onChange={(event) => updateField('grade', event.target.value)} placeholder="Form 4 / Grade 12" />
              <FormInput label="Topic" value={form.topicTitle} onChange={(event) => updateField('topicTitle', event.target.value)} placeholder="Topic name" />
            </div>

            {subjectGuidance ? <Notice tone="info">{subjectGuidance}</Notice> : null}

            <FormInput label="Access Level / Package" value={form.accessLevel} onChange={(event) => updateField('accessLevel', event.target.value)} placeholder="FREE, PAID, ACTIVE_PACKAGE, or exact package name" />
            <div className="grid gap-4 md:grid-cols-2">
              <FormTextarea label="Learning Objectives" value={form.learningObjectives} onChange={(event) => updateField('learningObjectives', event.target.value)} placeholder="- Define the main idea&#10;- Apply it to an exam-style problem" />
              <FormTextarea label="Key Concepts / Terms" value={form.keyConcepts} onChange={(event) => updateField('keyConcepts', event.target.value)} placeholder="- Key term: short meaning&#10;- Formula or principle" />
            </div>
            <FormTextarea label="Main Explanation" value={form.content} onChange={(event) => updateField('content', event.target.value)} rows={8} placeholder="Write the main explanation only. Keep objectives, examples, and summary in their separate fields below." />
            <FormTextarea label="Worked Examples" value={form.workedExamples} onChange={(event) => updateField('workedExamples', event.target.value)} rows={5} placeholder="Use numbered, step-by-step examples where appropriate." />
            <FormTextarea label="Revision Summary" value={form.summary} onChange={(event) => updateField('summary', event.target.value)} placeholder="Short recap of the most important points." />

            {form.content ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-bold text-slate-950">Online Note Preview</h4>
                <MarkdownText text={form.content} />
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="Diagram/Image URL" value={form.imageUrl} onChange={(event) => updateField('imageUrl', event.target.value)} placeholder="/uploads/diagram.png or https://..." />
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Upload Diagram/Image</span>
                <input className="input" type="file" accept="image/*" onChange={(event) => uploadFile(event.target.files?.[0], 'imageUrl')} />
                <p className="text-xs text-slate-500">{uploading === 'imageUrl' ? 'Uploading image...' : 'Use diagrams where educationally useful, not automatically for every subject.'}</p>
              </div>
            </div>
            <FormInput label="Diagram Caption" value={form.diagramCaption} onChange={(event) => updateField('diagramCaption', event.target.value)} placeholder="Explain what the learner should notice in the diagram." />

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="Student PDF Note URL" value={form.pdfUrl} onChange={(event) => updateField('pdfUrl', event.target.value)} placeholder="/uploads/note.pdf or https://..." />
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Upload Student PDF</span>
                <input className="input" type="file" accept="application/pdf" onChange={(event) => uploadFile(event.target.files?.[0], 'pdfUrl')} />
                <p className="text-xs text-slate-500">{uploading === 'pdfUrl' ? 'Uploading PDF...' : 'Online note content remains required for a strong notes experience.'}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="Teacher Guide PDF URL" value={form.teacherGuidePdfUrl} onChange={(event) => updateField('teacherGuidePdfUrl', event.target.value)} placeholder="/uploads/guide.pdf or https://..." />
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Upload Teacher Guide PDF</span>
                <input className="input" type="file" accept="application/pdf" onChange={(event) => uploadFile(event.target.files?.[0], 'teacherGuidePdfUrl')} />
                <p className="text-xs text-slate-500">{uploading === 'teacherGuidePdfUrl' ? 'Uploading guide...' : 'Teacher downloads require active Teacher Materials access.'}</p>
              </div>
            </div>

            <FormTextarea label="Common Learner Mistakes" value={form.commonMistakes} onChange={(event) => updateField('commonMistakes', event.target.value)} placeholder="List misconceptions or errors learners often make." />
            <FormTextarea label="Exam-Style Guidance" value={form.examStyleGuidance} onChange={(event) => updateField('examStyleGuidance', event.target.value)} placeholder="Use safe wording: exam-style, aligned with common exam patterns, modeled on syllabus expectations." />
            <FormTextarea label="Answers and Explanations / Marking Guidance" value={form.answersAndExplanations} onChange={(event) => updateField('answersAndExplanations', event.target.value)} />

            <div className="flex flex-wrap gap-3">
              <PrimaryButton disabled={saving || Boolean(uploading)}>{saving ? 'Saving...' : editingId ? 'Update Material' : 'Create Material'}</PrimaryButton>
              {editingId ? <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button> : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Content Library" subtitle="Review active, draft, student, teacher, and package-controlled materials.">
          {loading ? <LoadingState text="Loading content materials..." /> : null}
          {!loading && materials.length === 0 ? (
            <EmptyState title="No content materials yet" text="Create online notes, teacher guides, or downloadable materials for supported subjects." />
          ) : (
            <div className="space-y-4">
              {materials.map((item) => (
                <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="badge badge-info">{item.contentType}</span>
                        <span className={item.status === 'ACTIVE' ? 'badge badge-success' : 'badge badge-warning'}>{item.status}</span>
                        <span className={item.qualityStatus === 'PUBLISHED' ? 'badge badge-success' : 'badge badge-warning'}>{item.qualityStatus || 'DRAFT'}</span>
                        <span className="badge bg-slate-100 text-slate-700">{item.audience}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{[item.subjectName || item.subject, item.grade, item.topicTitle || item.topic].filter(Boolean).join(' / ') || 'General material'}</p>
                      <p className="mt-2 text-sm text-slate-600">Access: {item.accessLevel || 'FREE'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.qualityStatus !== 'PUBLISHED' ? <button className="btn btn-success" onClick={() => publishMaterial(item.id)}>Publish</button> : null}
                      <button className="btn btn-secondary" onClick={() => editMaterial(item)}>Edit</button>
                      <button className="btn border border-red-200 bg-red-50 text-red-700" onClick={() => deleteMaterial(item.id)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}
