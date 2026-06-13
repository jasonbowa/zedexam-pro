import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import PaymentInstructions from '../components/PaymentInstructions';
import { API_ROOT, authFetch } from '../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../components/ui';
import MarkdownText from '../components/MarkdownText';
import { buildStructuredNote, extractStudyPoints } from '../lib/noteSections';

function resolveAssetUrl(url) {
  if (!url) return '';
  return String(url).startsWith('http') ? url : `${API_ROOT}${url}`;
}

function displayGrade(value) {
  return String(value || '').replace(/_/g, ' ');
}

function groupMaterials(materials) {
  const groups = new Map();

  materials.forEach((item) => {
    const subject = item.subjectName || item.subject || 'General';
    const grade = displayGrade(item.grade) || 'All levels';
    const key = `${subject}::${grade}`;
    if (!groups.has(key)) groups.set(key, { subject, grade, materials: [] });
    groups.get(key).materials.push(item);
  });

  return [...groups.values()];
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
      const searchable = [
        item.title,
        item.topicTitle,
        item.topic,
        item.learningObjectives,
        item.keyConcepts,
        item.content,
        item.workedExamples,
        item.summary,
      ].filter(Boolean).join(' ').toLowerCase();
      return subjectMatch && gradeMatch && (!search || searchable.includes(search));
    });
  }, [materials, filters]);
  const grouped = useMemo(() => groupMaterials(filtered), [filtered]);
  const lockedDownloads = filtered.some((item) => item.downloadLocked || item.contentLocked);

  return (
    <PageShell
      title="Online Notes"
      subtitle="Study organized lessons with objectives, key concepts, visual summaries, worked examples, revision points, and diagrams where supplied."
      action={
        <input className="input h-11 min-w-[240px] bg-white text-slate-900" placeholder="Search notes" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
      }
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {lockedDownloads ? <PaymentInstructions status="Package required for some downloads" packageName="Student notes downloads" /> : null}

      <SectionCard
        title="Student Materials"
        subtitle={`${filtered.length} structured note(s) available after filters.`}
        action={
          <>
            <select className="input h-11 min-w-[190px]" value={filters.subject} onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}>
              <option value="">All subjects</option>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <select className="input h-11 min-w-[160px]" value={filters.grade} onChange={(event) => setFilters((prev) => ({ ...prev, grade: event.target.value }))}>
              <option value="">All grades/forms</option>
              {grades.map((grade) => <option key={grade} value={grade}>{displayGrade(grade)}</option>)}
            </select>
          </>
        }
      >
        {loading ? <LoadingState text="Loading structured notes..." /> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState title="No notes found" text="Try another subject or grade. Admin can publish structured notes and upload subject diagrams from the content materials screen." />
        ) : null}
        {!loading && grouped.length > 0 ? (
          <div className="space-y-10">
            {grouped.map((group) => (
              <section key={`${group.subject}-${group.grade}`}>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Subject collection</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{group.subject}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{group.grade}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">{group.materials.length} lesson(s)</span>
                </div>
                <div className="space-y-6">
                  {group.materials.map((item, index) => (
                    <StructuredMaterialCard key={item.id} item={item} lessonNumber={index + 1} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </SectionCard>
    </PageShell>
  );
}

function StructuredMaterialCard({ item, lessonNumber }) {
  const note = buildStructuredNote(item);
  const studyPoints = extractStudyPoints(note);
  const topic = item.topicTitle || item.topic || note.embeddedTitle || item.title;
  const sections = [
    ['Introduction', note.introduction, 'border-cyan-300 bg-cyan-50/60'],
    ['Main Explanation', note.explanation, 'border-blue-300 bg-blue-50/60'],
    ['Worked Examples', note.examples, 'border-violet-300 bg-violet-50/60'],
    ['Revision Summary', note.summary, 'border-emerald-300 bg-emerald-50/60'],
    ['Practice Activity', note.practice, 'border-orange-300 bg-orange-50/60'],
    ['Common Learner Mistakes', item.commonMistakes, 'border-rose-300 bg-rose-50/60'],
    ['Exam-Style Guidance', item.examStyleGuidance, 'border-amber-300 bg-amber-50/60'],
    ['Answers and Explanations', item.answersAndExplanations, 'border-teal-300 bg-teal-50/60'],
  ].filter(([, text]) => String(text || '').trim());

  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <header className="bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-900 px-5 py-6 text-white sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-black ring-1 ring-white/20">
              {String(lessonNumber).padStart(2, '0')}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">{topic}</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold text-slate-300">{item.contentType} / {item.accessLevel || 'FREE'} access</p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20">{item.qualityStatus || 'PUBLISHED'}</span>
        </div>
      </header>

      <div className="p-5 sm:p-7">
        {item.contentLocked ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {item.lockedReason || 'Activate a matching package to read this material.'}
          </div>
        ) : (
          <>
            {(note.objectives || note.keyConcepts) ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {note.objectives ? <OverviewBlock number="01" title="Learning Objectives" text={note.objectives} /> : null}
                {note.keyConcepts ? <OverviewBlock number="02" title="Key Concepts" text={note.keyConcepts} /> : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              {item.imageUrl ? (
                <figure className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                  <img className="max-h-[460px] w-full rounded-2xl object-contain" src={resolveAssetUrl(item.imageUrl)} alt={item.diagramCaption || `${item.title} diagram`} />
                  <figcaption className="px-2 pb-1 pt-3 text-sm font-semibold leading-6 text-slate-600">
                    {item.diagramCaption || `Diagram for ${topic}. Study the labels and connect them to the key concepts.`}
                  </figcaption>
                </figure>
              ) : studyPoints.length ? (
                <StudyMap topic={topic} points={studyPoints} />
              ) : null}

              <div className={item.imageUrl || studyPoints.length ? 'space-y-4' : 'space-y-4 xl:col-span-2'}>
                {sections.map(([title, text, tone], index) => (
                  <MaterialSection key={title} number={index + 3} title={title} text={text} tone={tone} />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          {item.pdfUrl ? <a className="btn btn-secondary" href={resolveAssetUrl(item.pdfUrl)} target="_blank" rel="noreferrer">Download PDF Note</a> : null}
          {item.downloadLocked ? <span className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-800">PDF download locked until package activation</span> : null}
        </div>
      </div>
    </article>
  );
}

function OverviewBlock({ number, title, text }) {
  return (
    <div className="rounded-[22px] border border-blue-100 bg-blue-50 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-xs font-black text-white">{number}</span>
        <h4 className="font-black text-slate-950">{title}</h4>
      </div>
      <MarkdownText text={text} />
    </div>
  );
}

function StudyMap({ topic, points }) {
  return (
    <figure className="rounded-[24px] border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-5">
      <figcaption className="text-xs font-black uppercase tracking-[0.18em] text-cyan-800">Visual study map</figcaption>
      <div className="mx-auto mt-5 max-w-sm rounded-2xl bg-slate-950 px-5 py-4 text-center text-sm font-black text-white shadow-lg">
        {topic}
      </div>
      <div className="mx-auto h-7 w-px bg-cyan-300" />
      <div className="grid gap-3 sm:grid-cols-2">
        {points.map((point, index) => (
          <div key={`${point}-${index}`} className="relative rounded-2xl border border-white bg-white p-4 text-sm font-bold leading-6 text-slate-700 shadow-sm">
            <span className="mb-2 block text-xs font-black text-cyan-700">{String(index + 1).padStart(2, '0')}</span>
            {point}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">This visual summary is generated from the lesson objectives and key concepts. Uploaded subject diagrams appear here when available.</p>
    </figure>
  );
}

function MaterialSection({ number, title, text, tone }) {
  return (
    <section className={`rounded-[22px] border-l-4 p-5 ring-1 ring-slate-200 ${tone}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs font-black text-slate-500">{String(number).padStart(2, '0')}</span>
        <h4 className="font-black text-slate-950">{title}</h4>
      </div>
      <MarkdownText text={text} />
    </section>
  );
}
