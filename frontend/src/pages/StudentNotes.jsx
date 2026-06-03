import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import PaymentInstructions from '../components/PaymentInstructions';
import { API_ROOT, authFetch } from '../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../components/ui';
import MarkdownText from '../components/MarkdownText';

function resolveAssetUrl(url) {
  if (!url) return '';
  return String(url).startsWith('http') ? url : `${API_ROOT}${url}`;
}

export default function StudentNotes() {
  const [materials, setMaterials] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ subject: '', grade: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [materialData, supportedData] = await Promise.all([
          authFetch('/content-materials/student'),
          authFetch('/content-materials/supported-subjects'),
        ]);
        setMaterials(Array.isArray(materialData) ? materialData : []);
        setSubjects(Array.isArray(supportedData?.subjects) ? supportedData.subjects : []);
      } catch (err) {
        setError(err.message || 'Failed to load notes.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const grades = useMemo(() => [...new Set(materials.map((item) => item.grade).filter(Boolean))], [materials]);
  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase().trim();
    return materials.filter((item) => {
      const subjectMatch = !filters.subject || item.subjectName === filters.subject || item.subject === filters.subject;
      const gradeMatch = !filters.grade || item.grade === filters.grade;
      const searchMatch = !search || `${item.title} ${item.topicTitle || item.topic || ''} ${item.content || ''}`.toLowerCase().includes(search);
      return subjectMatch && gradeMatch && searchMatch;
    });
  }, [materials, filters]);

  const lockedDownloads = filtered.some((item) => item.downloadLocked || item.contentLocked);

  return (
    <PageShell
      title="Online Notes"
      subtitle="Read active notes inside the app, view diagrams where useful, and download PDFs when your package allows it."
      action={
        <input className="input h-11 min-w-[240px] bg-white text-slate-900" placeholder="Search notes" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
      }
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {lockedDownloads ? <PaymentInstructions status="Package required for some downloads" packageName="Student notes downloads" /> : null}

      <SectionCard
        title="Student Materials"
        subtitle={`${filtered.length} note(s) available after filters.`}
        action={
          <>
            <select className="input h-11 min-w-[190px]" value={filters.subject} onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}>
              <option value="">All subjects</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <select className="input h-11 min-w-[160px]" value={filters.grade} onChange={(event) => setFilters((prev) => ({ ...prev, grade: event.target.value }))}>
              <option value="">All grades/forms</option>
              {grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
          </>
        }
      >
        {loading ? <LoadingState text="Loading notes..." /> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState title="No notes found" text="Admin can publish online notes, diagrams, PDF notes, and package-controlled downloads from the content materials screen." />
        ) : null}
        {!loading && filtered.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filtered.map((item) => (
              <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{[item.subjectName || item.subject, item.grade].filter(Boolean).join(' / ') || 'General'}</p>
                    <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{item.topicTitle || item.topic || 'General topic'} / {item.contentType}</p>
                  </div>
                  <span className="badge badge-info">{item.accessLevel || 'FREE'}</span>
                </div>

                {item.contentLocked ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    {item.lockedReason || 'Activate a matching package to read this material.'}
                  </div>
                ) : null}
                {item.imageUrl ? <img className="mt-4 max-h-[360px] w-full rounded-2xl border border-slate-200 object-contain bg-slate-50" src={resolveAssetUrl(item.imageUrl)} alt={`${item.title} diagram`} /> : null}
                {item.content ? <MaterialBlock title="Explanation" text={item.content} /> : null}
                {item.commonMistakes ? <MaterialBlock title="Common Learner Mistakes" text={item.commonMistakes} /> : null}
                {item.examStyleGuidance ? <MaterialBlock title="Exam-Style Guidance" text={item.examStyleGuidance} /> : null}
                {item.answersAndExplanations ? <MaterialBlock title="Answers and Explanations" text={item.answersAndExplanations} /> : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  {item.pdfUrl ? <a className="btn btn-secondary" href={resolveAssetUrl(item.pdfUrl)} target="_blank" rel="noreferrer">Download PDF Note</a> : null}
                  {item.downloadLocked ? <span className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-800">PDF download locked until package activation</span> : null}
                </div>
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
