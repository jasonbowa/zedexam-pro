import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { EmptyState, LoadingState, Notice, SectionCard, StatCard } from '../components/ui';
import { api } from '../lib/api';

function normalizeResult(row) {
  const total = Number(row.totalMarks || row.totalQuestions || row.total || 0);
  const percentage = row.percentage || (total > 0 ? Math.round(((row.score || 0) / total) * 100) : 0);
  return { ...row, total, percentage };
}

export default function Analytics() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/results');
        setResults(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        setError(err.message || 'Failed to load analytics.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const normalized = results.map(normalizeResult);
    const percentages = normalized.map((row) => row.percentage || 0);
    return {
      totalQuizzes: normalized.length,
      average: percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0,
      best: percentages.length ? Math.max(...percentages) : 0,
      lowest: percentages.length ? Math.min(...percentages) : 0,
      rows: normalized.slice(0, 10),
    };
  }, [results]);

  return (
    <PageShell title="Performance Analytics" subtitle="A cleaner progress view based on saved results.">
      {!loading && !error && results.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Attempts" value={summary.totalQuizzes} hint="Saved quiz records" />
          <StatCard label="Average" value={`${summary.average}%`} hint="Mean score level" />
          <StatCard label="Best" value={`${summary.best}%`} hint="Highest result" />
          <StatCard label="Lowest" value={`${summary.lowest}%`} hint="Lowest result" />
        </div>
      ) : null}

      <SectionCard title="Recent Performance" subtitle="The latest result records coming from the backend.">
        {loading ? <LoadingState text="Loading performance data..." /> : null}
        {!loading && error ? <Notice tone="danger">{error}</Notice> : null}
        {!loading && !error && results.length === 0 ? <EmptyState title="No analytics yet" text="Quiz attempts will populate this dashboard once learners submit work." /> : null}
        {!loading && !error && results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-4 py-3">Quiz</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row, index) => (
                  <tr key={row.id || index} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.quizTitle || row.topicTitle || 'Quiz'}</td>
                    <td className="px-4 py-3">{row.score || 0}</td>
                    <td className="px-4 py-3">{row.total || 0}</td>
                    <td className="px-4 py-3">{row.percentage || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>
    </PageShell>
  );
}
