import { useEffect, useMemo, useState } from 'react';
import PageShell from '../../components/PageShell';
import PaymentInstructions from '../../components/PaymentInstructions';
import { API_ROOT, authFetch, getStoredUser } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../../components/ui';
import MarkdownText from '../../components/MarkdownText';

const configByType = {
  notes: {
    title: 'Teacher Notes',
    endpoint: '/content-materials/teacher?contentType=TEACHER_NOTE',
    subtitle: 'Browse teaching notes structured by subject, grade/form, topic, objectives, and key concepts.',
  },
  guides: {
    title: 'Teacher Guides',
    endpoint: '/content-materials/teacher?contentType=TEACHER_GUIDE',
    subtitle: 'Use teaching methods, learner-difficulty notes, assessment prompts, and marking guidance.',
  },
  downloads: {
    title: 'Downloads',
    endpoint: '/content-materials/teacher?contentType=DOWNLOAD',
    subtitle: 'Access downloadable links and PDF support materials where available.',
  },
};

function resolveAssetUrl(url) {
  if (!url) return '';
  return String(url).startsWith('http') ? url : `${API_ROOT}${url}`;
}

function isActiveAccess(access) {
  return access?.isActive === true && String(access?.status || '').toUpperCase() === 'ACTIVE';
}

export default function TeacherMaterialsList({ type = 'notes' }) {
  const config = configByType[type] || configByType.notes;
  const user = useMemo(() => getStoredUser(), []);
  const [access, setAccess] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [filters, setFilters] = useState({ subject: '', grade: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const me = await authFetch('/teacher-materials/me');
        setAccess(me.access || null);

        if (isActiveAccess(me.access)) {
          const data = await authFetch(config.endpoint);
          setMaterials(Array.isArray(data) ? data : []);
        } else {
          setMaterials([]);
        }
      } catch (err) {
        setError(err.message || `Failed to load ${config.title}.`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [config.endpoint, config.title]);

  const subjects = useMemo(() => [...new Set(materials.map((item) => item.subject).filter(Boolean))], [materials]);
  const grades = useMemo(() => [...new Set(materials.map((item) => item.grade).filter(Boolean))], [materials]);
  const filtered = useMemo(() => {
    return materials.filter((item) => {
      const subjectMatch = !filters.subject || item.subject === filters.subject;
      const gradeMatch = !filters.grade || item.grade === filters.grade;
      return subjectMatch && gradeMatch;
    });
  }, [materials, filters]);

  const active = isActiveAccess(access);
  const status = access?.status || user?.status || 'Pending';
  const packageName = access?.package || user?.package || 'Teacher Materials';

  return (
    <PageShell title={config.title} subtitle={config.subtitle}>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!active && !loading ? <PaymentInstructions status={status} packageName={packageName} /> : null}

      <SectionCard
        title={config.title}
        subtitle={active ? `${filtered.length} material(s) available after filters.` : 'Materials unlock after payment confirmation.'}
        action={
          active ? (
            <>
              <select className="input h-11 min-w-[180px]" value={filters.subject} onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}>
                <option value="">All subjects</option>
                {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
              <select className="input h-11 min-w-[160px]" value={filters.grade} onChange={(event) => setFilters((prev) => ({ ...prev, grade: event.target.value }))}>
                <option value="">All grades/forms</option>
                {grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </>
          ) : null
        }
      >
        {loading ? <LoadingState text={`Loading ${config.title.toLowerCase()}...`} /> : null}
        {!loading && active && filtered.length === 0 ? (
          <EmptyState title="No matching materials" text="Try another subject or grade filter, or ask admin to publish materials for this area." />
        ) : null}
        {!loading && active && filtered.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{[item.subject, item.grade].filter(Boolean).join(' / ') || 'General'}</p>
                    <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{item.topic || 'General topic'}</p>
                  </div>
                  {item.pdfUrl ? (
                    <a className="btn btn-secondary" href={resolveAssetUrl(item.pdfUrl)} target="_blank" rel="noreferrer">Download PDF</a>
                  ) : null}
                  {item.teacherGuidePdfUrl ? (
                    <a className="btn btn-secondary" href={resolveAssetUrl(item.teacherGuidePdfUrl)} target="_blank" rel="noreferrer">Download Teacher Guide</a>
                  ) : null}
                </div>

                {item.imageUrl ? <img className="mt-4 max-h-[360px] w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain" src={resolveAssetUrl(item.imageUrl)} alt={`${item.title} diagram`} /> : null}
                {item.content ? <MaterialBlock title="Online Material" text={item.content} /> : null}
                {item.summary ? <MaterialBlock title="Overview" text={item.summary} /> : null}
                {item.learningObjectives ? <MaterialBlock title="Learning Objectives" text={item.learningObjectives} /> : null}
                {item.keyConcepts ? <MaterialBlock title="Key Concepts" text={item.keyConcepts} /> : null}
                {item.commonMistakes ? <MaterialBlock title="Common Learner Mistakes" text={item.commonMistakes} /> : null}
                {item.examStyleGuidance ? <MaterialBlock title="Exam-Style Guidance" text={item.examStyleGuidance} /> : null}
                {item.answersAndExplanations ? <MaterialBlock title="Answers and Explanations / Marking Guide" text={item.answersAndExplanations} /> : null}
                {item.suggestedTeachingMethod ? <MaterialBlock title="Suggested Teaching Method" text={item.suggestedTeachingMethod} /> : null}
                {item.commonLearnerDifficulties ? <MaterialBlock title="Common Learner Difficulties" text={item.commonLearnerDifficulties} /> : null}
                {item.assessmentQuestions ? <MaterialBlock title="Assessment Questions" text={item.assessmentQuestions} /> : null}
                {item.markingGuide ? <MaterialBlock title="Answers / Marking Guide" text={item.markingGuide} /> : null}
              </article>
            ))}
          </div>
        ) : null}
      </SectionCard>
    </PageShell>
  );
}

function MaterialBlock({ title, text }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <h4 className="text-sm font-bold text-slate-950">{title}</h4>
      <MarkdownText text={text} />
    </div>
  );
}
