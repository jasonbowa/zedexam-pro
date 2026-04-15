import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authFetch } from '../api';
import PageShell from '../components/PageShell';
import { LoadingState, Notice, ProgressBar, SectionCard, StatCard } from '../components/ui';

export default function ResultsPage() {
  const { resultId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await authFetch(`/results/${resultId}`);
        setResult(data || null);
      } catch (err) {
        setError(err.message || 'Failed to load result.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [resultId]);

  const percent = useMemo(() => {
    if (!result) return 0;
    const score = Number(result.score || 0);
    const total = Number(result.total || result.totalQuestions || 0);
    return total > 0 ? Math.round((score / total) * 100) : score;
  }, [result]);

  const passed = percent >= 50;

  return (
    <PageShell
      title="Result Summary"
      subtitle="Review the learner's performance, identify next steps, and open the certificate when eligible."
      action={<Link to="/subjects" className="btn border border-white/20 bg-white/10 text-white hover:bg-white/20">Back to Subjects</Link>}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loading ? (
        <LoadingState text="Loading result..." />
      ) : !result ? (
        <Notice tone="warning">Result not found.</Notice>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Score" value={`${percent}%`} hint="Overall performance" accent={passed ? 'emerald' : 'amber'} />
            <StatCard label="Status" value={passed ? 'Passed' : 'Needs Work'} hint={passed ? 'Certificate eligible' : 'More revision recommended'} accent="slate" />
            <StatCard label="Topic" value={result.topic?.name || result.topicName || result.title || 'Quiz'} hint="Attempt reviewed" accent="blue" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
            <SectionCard title="Performance Breakdown" subtitle="Use this summary to decide whether to revise or move on.">
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>Completion score</span>
                    <span className="font-semibold text-slate-950">{percent}%</span>
                  </div>
                  <ProgressBar value={percent} />
                </div>

                <div className={`rounded-[24px] border p-5 text-sm leading-7 ${passed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  {passed
                    ? 'Strong result. This attempt qualifies for a certificate and shows the learner is ready to progress.'
                    : 'This score is below the pass mark. Review the topic again and attempt another quiz to improve confidence.'}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Actions" subtitle="Choose the next best step.">
              <div className="space-y-3">
                <Link to="/subjects" className="btn btn-primary w-full">Practice More</Link>
                {passed ? <Link to={`/certificate/${result.id}`} className="btn btn-success w-full">View Certificate</Link> : null}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </PageShell>
  );
}
