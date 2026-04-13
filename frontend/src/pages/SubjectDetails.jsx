import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authFetch } from '../api';
import PageShell from '../components/PageShell';
import { EmptyState, LoadingState, Notice, ProgressBar, SectionCard, StatCard } from '../components/ui';

export default function SubjectDetails() {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState(null);
  const [topics, setTopics] = useState([]);
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSubjectDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const [subjectsData, topicsData, resultsData] = await Promise.allSettled([
          authFetch('/subjects'),
          authFetch(`/subjects/${subjectId}/topics`),
          authFetch('/results/my-results'),
        ]);

        const subjects = subjectsData.status === 'fulfilled' && Array.isArray(subjectsData.value) ? subjectsData.value : [];
        setSubject(subjects.find((item) => String(item.id) === String(subjectId)) || null);
        setTopics(topicsData.status === 'fulfilled' && Array.isArray(topicsData.value) ? topicsData.value : []);
        setResults(resultsData.status === 'fulfilled' && Array.isArray(resultsData.value) ? resultsData.value : []);
      } catch (err) {
        setError(err.message || 'Failed to load subject details.');
      } finally {
        setLoading(false);
      }
    };

    loadSubjectDetails();
  }, [subjectId]);

  const topicStats = useMemo(() => {
    const map = {};
    results.forEach((result) => {
      const topicIdFromResult = result.topicId || result.topic?.id || result.quiz?.topicId || result.topic_id;
      if (!topicIdFromResult) return;
      const rawScore = Number(result.score || 0);
      const rawTotal = Number(result.total || result.totalQuestions || 0);
      const percent = rawTotal > 0 ? Math.round((rawScore / rawTotal) * 100) : rawScore;
      if (!map[topicIdFromResult]) map[topicIdFromResult] = { attempts: 0, bestScore: 0, latestResultId: null };
      map[topicIdFromResult].attempts += 1;
      map[topicIdFromResult].bestScore = Math.max(map[topicIdFromResult].bestScore, percent);
      map[topicIdFromResult].latestResultId = result.id;
    });
    return map;
  }, [results]);

  const filteredTopics = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return topics;
    return topics.filter((topic) => `${topic.title || topic.name || ''} ${topic.description || ''}`.toLowerCase().includes(q));
  }, [search, topics]);

  const bestOverall = useMemo(() => {
    const scores = Object.values(topicStats).map((item) => item.bestScore || 0);
    return scores.length ? Math.max(...scores) : 0;
  }, [topicStats]);

  return (
    <PageShell
      title={subject?.name || 'Subject Details'}
      subtitle="Choose a topic, see previous performance, and continue revision with a more structured study view."
      action={
        <>
          <Link to="/subjects" className="btn border border-white/20 bg-white/10 text-white hover:bg-white/20">All Subjects</Link>
          <input className="input h-11 min-w-[260px] bg-white text-slate-900" placeholder="Search topics" value={search} onChange={(e) => setSearch(e.target.value)} />
        </>
      }
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Topics" value={loading ? '...' : topics.length} hint="Available for this subject" accent="slate" />
        <StatCard label="Tracked Results" value={loading ? '...' : Object.keys(topicStats).length} hint="Topics already attempted" accent="blue" />
        <StatCard label="Best Score" value={loading ? '...' : `${bestOverall}%`} hint="Highest recorded performance" accent="emerald" />
      </div>

      <SectionCard title="Topic Library" subtitle="Open a topic to start practice or review your best score so far.">
        {loading ? (
          <LoadingState text="Loading topics..." />
        ) : filteredTopics.length === 0 ? (
          <EmptyState title="No topics found" text="This subject does not have matching topics yet. Add them from the admin panel or change your search." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredTopics.map((topic) => {
              const stats = topicStats[topic.id] || { attempts: 0, bestScore: 0, latestResultId: null };
              const passed = stats.bestScore >= 50;
              return (
                <div key={topic.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{topic.title || topic.name || 'Topic'}</h3>
                      <p className="mt-1 text-sm text-slate-500">{topic.description || 'Focused revision and quiz practice for this topic.'}</p>
                    </div>
                    <span className={`badge ${passed ? 'badge-success' : 'badge-warning'}`}>{stats.attempts ? `${stats.bestScore}% best` : 'New topic'}</span>
                  </div>

                  <div className="mt-4 space-y-3 rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Attempts</span>
                      <span className="font-semibold text-slate-900">{stats.attempts}</span>
                    </div>
                    <ProgressBar value={stats.bestScore} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link to={`/quiz/${topic.id}`} className="btn btn-primary">Start Quiz</Link>
                    {stats.latestResultId ? <Link to={`/results/${stats.latestResultId}`} className="btn btn-secondary">View Last Result</Link> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
