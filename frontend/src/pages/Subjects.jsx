import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../api';
import PageShell from '../components/PageShell';
import PaymentInstructions from '../components/PaymentInstructions';
import { EmptyState, LoadingState, Notice, SectionCard } from '../components/ui';

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSubjects = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await authFetch('/subjects');
        setSubjects(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load subjects.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return subjects;
    return subjects.filter((subject) => `${subject.name || ''} ${subject.description || ''}`.toLowerCase().includes(q));
  }, [search, subjects]);

  const hasLockedSubjects = filtered.some((subject) => subject.accessLocked);
  const packageName = filtered.find((subject) => subject.access?.package)?.access?.package?.name || 'Student Package';

  return (
    <PageShell
      title="Subjects"
      subtitle="Browse the learning areas available on the platform and jump straight into topic-based practice."
      action={<input className="input h-11 min-w-[260px] bg-white" placeholder="Search subjects" value={search} onChange={(e) => setSearch(e.target.value)} />}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {hasLockedSubjects ? <PaymentInstructions status="Package access limited" packageName={packageName} /> : null}

      <SectionCard title="All Learning Areas" subtitle={`${filtered.length} subject(s) available for practice.`}>
        {loading ? (
          <LoadingState text="Loading subjects..." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching subjects" text="Try another search term or add subjects from the admin panel." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((subject) => {
              const locked = Boolean(subject.accessLocked);
              const Card = locked ? 'div' : Link;
              const cardProps = locked ? {} : { to: `/subjects/${subject.id}` };

              return (
                <Card
                  key={subject.id}
                  {...cardProps}
                  className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition ${locked ? 'opacity-85' : 'hover:-translate-y-0.5 hover:shadow-md'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-950 to-blue-700 text-xl font-black text-white">
                      {String(subject.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <span className={`badge ${locked ? 'badge-warning' : 'badge-info'}`}>{locked ? 'Locked' : 'Study'}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-slate-950">{subject.name || 'Subject'}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{subject.description || 'Topic practice, quizzes, revision, and exam preparation.'}</p>
                  {locked ? (
                    <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                      {subject.accessReason || 'Activate a package to unlock this subject.'}
                    </p>
                  ) : null}
                  <div className="mt-5 flex items-center justify-between text-sm font-semibold text-blue-700">
                    <span>{locked ? 'Package required' : 'Open subject'}</span>
                    <span>-&gt;</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
