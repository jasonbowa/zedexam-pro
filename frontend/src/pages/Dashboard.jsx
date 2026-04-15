import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, getStoredUser } from '../api';
import PageShell from '../components/PageShell';
import { EmptyState, LoadingState, Notice, SectionCard, StatCard } from '../components/ui';

export default function Dashboard() {
  const user = useMemo(() => getStoredUser(), []);
  const [subjects, setSubjects] = useState([]);
  const [results, setResults] = useState([]);
  const [mockExams, setMockExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const [subjectsData, resultsData, mockData, subscriptionData] = await Promise.allSettled([
          authFetch('/subjects'),
          authFetch('/results/my-results'),
          authFetch('/mock-exams'),
          authFetch('/subscriptions/my-plan'),
        ]);

        setSubjects(subjectsData.status === 'fulfilled' && Array.isArray(subjectsData.value) ? subjectsData.value : []);
        setResults(resultsData.status === 'fulfilled' && Array.isArray(resultsData.value) ? resultsData.value : []);
        setMockExams(mockData.status === 'fulfilled' && Array.isArray(mockData.value) ? mockData.value : []);
        setSubscription(subscriptionData.status === 'fulfilled' ? subscriptionData.value?.subscription || null : null);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const averageScore = useMemo(() => {
    if (!results.length) return 0;
    const total = results.reduce((sum, item) => {
      const rawScore = Number(item.score || 0);
      const rawTotal = Number(item.total || item.totalQuestions || 0);
      return sum + (rawTotal > 0 ? Math.round((rawScore / rawTotal) * 100) : rawScore);
    }, 0);
    return Math.round(total / results.length);
  }, [results]);

  const certificatesEarned = useMemo(
    () => results.filter((item) => {
      const rawScore = Number(item.score || 0);
      const rawTotal = Number(item.total || item.totalQuestions || 0);
      const percent = rawTotal > 0 ? Math.round((rawScore / rawTotal) * 100) : rawScore;
      return percent >= 50;
    }).length,
    [results]
  );

  const recentResults = results.slice(0, 5);
  const firstName = user?.name ? user.name.split(' ')[0] : 'Student';

  return (
    <PageShell
      title={`Welcome back, ${firstName}`}
      subtitle="Track your subjects, recent performance, and next best study action from one clean dashboard."
      action={
        <>
          <Link to="/subjects" className="btn bg-white text-slate-950 hover:bg-slate-100">Browse Subjects</Link>
          <Link to="/mock-exams" className="btn border border-white/20 bg-white/10 text-white hover:bg-white/20">Mock Exams</Link>
        </>
      }
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subjects" value={loading ? '...' : subjects.length} hint="Available learning areas" accent="slate" />
        <StatCard label="Attempts" value={loading ? '...' : results.length} hint="Completed quiz submissions" accent="blue" />
        <StatCard label="Average Score" value={loading ? '...' : `${averageScore}%`} hint="Overall student performance" accent="emerald" />
        <StatCard label="Certificates" value={loading ? '...' : certificatesEarned} hint="Passed with 50% or above" accent="amber" />
        <StatCard label="Plan" value={loading ? '...' : subscription?.package?.name || 'Free'} hint={subscription?.status || 'No active paid plan'} accent="white" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Continue Learning" subtitle="Choose a subject and keep building mastery topic by topic.">
          {loading ? (
            <LoadingState text="Loading subjects..." />
          ) : subjects.length === 0 ? (
            <EmptyState title="No subjects yet" text="Once subjects are available, they will appear here for students to begin learning." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {subjects.slice(0, 6).map((subject) => (
                <Link key={subject.id} to={`/subjects/${subject.id}`} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white">
                      {String(subject.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <span className="badge badge-info">Open</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-950">{subject.name || 'Subject'}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {subject.description || 'Practice questions, revision topics, and structured exam preparation.'}
                  </p>
                  <p className="mt-4 text-sm font-semibold text-blue-700">Open Subject →</p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Platform Snapshot" subtitle="Quick next steps to help the student move forward.">
          <div className="space-y-4">
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-900">Mock exams ready</p>
              <p className="mt-1 text-sm text-slate-500">{loading ? '...' : `${mockExams.length} timed mock exam(s) available for practice.`}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-900">Student profile</p>
              <p className="mt-1 text-sm text-slate-500">{user?.name || 'Student'} • {user?.phoneNumber || user?.phone || user?.email || 'No contact saved'}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-900">Best next action</p>
              <p className="mt-1 text-sm text-slate-500">{results.length ? 'Review recent results, then return to weak topics.' : 'Start with a subject and complete your first quiz attempt.'}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-900">Current plan</p>
              <p className="mt-1 text-sm text-slate-500">{subscription?.package?.name ? `${subscription.package.name} • ${subscription.status}` : 'You are on the free plan until a package is assigned or purchased.'}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Recent Results" subtitle="See performance, status, and certificate eligibility at a glance.">
        {loading ? (
          <LoadingState text="Loading results..." />
        ) : recentResults.length === 0 ? (
          <EmptyState title="No results yet" text="When the student completes quizzes, results will appear here with the option to open details and certificates." action={<Link className="btn btn-primary" to="/subjects">Start Practising</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-4 py-3 font-semibold">Topic</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((result) => {
                  const rawScore = Number(result.score || 0);
                  const rawTotal = Number(result.total || result.totalQuestions || 0);
                  const score = rawTotal > 0 ? Math.round((rawScore / rawTotal) * 100) : rawScore;
                  const passed = score >= 50;
                  return (
                    <tr key={result.id} className="border-b border-slate-100">
                      <td className="px-4 py-4 font-medium text-slate-900">{result.topic?.name || result.topicName || result.title || 'Quiz Result'}</td>
                      <td className="px-4 py-4 text-slate-700">{score}%</td>
                      <td className="px-4 py-4">
                        <span className={`badge ${passed ? 'badge-success' : 'badge-warning'}`}>{passed ? 'Passed' : 'Needs work'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <Link className="font-semibold text-blue-700" to={`/results/${result.id}`}>Open Result</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
