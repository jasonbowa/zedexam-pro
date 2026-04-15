import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, getStoredUser } from '../../api';
import PageShell from '../../components/PageShell';
import { EmptyState, LoadingState, Notice, SectionCard, StatCard } from '../../components/ui';

export default function AdminDashboard() {
  const user = useMemo(() => getStoredUser(), []);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [mockExams, setMockExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [schools, setSchools] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAdminDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const responses = await Promise.allSettled([
          authFetch('/subjects'),
          authFetch('/topics'),
          authFetch('/questions'),
          authFetch('/mock-exams'),
          authFetch('/admin/students'),
          authFetch('/admin/results'),
          authFetch('/schools'),
          authFetch('/teachers'),
          authFetch('/subscriptions/packages'),
          authFetch('/subscriptions/admin/assignments'),
        ]);

        const [subjectsRes, topicsRes, questionsRes, mockRes, studentsRes, resultsRes, schoolsRes, teachersRes, packagesRes, assignmentsRes] = responses;
        setSubjects(subjectsRes.status === 'fulfilled' && Array.isArray(subjectsRes.value) ? subjectsRes.value : []);
        setTopics(topicsRes.status === 'fulfilled' && Array.isArray(topicsRes.value) ? topicsRes.value : []);
        setQuestions(questionsRes.status === 'fulfilled' && Array.isArray(questionsRes.value) ? questionsRes.value : []);
        setMockExams(mockRes.status === 'fulfilled' && Array.isArray(mockRes.value) ? mockRes.value : []);
        setStudents(studentsRes.status === 'fulfilled' && Array.isArray(studentsRes.value) ? studentsRes.value : []);
        setResults(resultsRes.status === 'fulfilled' && Array.isArray(resultsRes.value) ? resultsRes.value : []);
        setSchools(schoolsRes.status === 'fulfilled' && Array.isArray(schoolsRes.value) ? schoolsRes.value : []);
        setTeachers(teachersRes.status === 'fulfilled' && Array.isArray(teachersRes.value) ? teachersRes.value : []);
        setPackages(packagesRes.status === 'fulfilled' && Array.isArray(packagesRes.value) ? packagesRes.value : []);
        setAssignments(assignmentsRes.status === 'fulfilled' && Array.isArray(assignmentsRes.value) ? assignmentsRes.value : []);
      } catch (err) {
        setError(err.message || 'Failed to load admin dashboard.');
      } finally {
        setLoading(false);
      }
    };
    loadAdminDashboard();
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

  const passRate = useMemo(() => {
    if (!results.length) return 0;
    const passed = results.filter((item) => {
      const rawScore = Number(item.score || 0);
      const rawTotal = Number(item.total || item.totalQuestions || 0);
      const percent = rawTotal > 0 ? Math.round((rawScore / rawTotal) * 100) : rawScore;
      return percent >= 50;
    }).length;
    return Math.round((passed / results.length) * 100);
  }, [results]);

  const recentResults = results.slice(0, 6);
  const adminName = user?.name || 'Administrator';

  return (
    <PageShell
      title="Admin Dashboard"
      subtitle={`Welcome, ${adminName}. Manage academic content, monitor learners, and keep the platform launch-ready.`}
      action={<Link to="/dashboard" className="btn bg-white text-slate-950 hover:bg-slate-100">Student View</Link>}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subjects" value={loading ? '...' : subjects.length} hint="Configured learning areas" accent="slate" />
        <StatCard label="Topics" value={loading ? '...' : topics.length} hint="Revision topics" accent="blue" />
        <StatCard label="Questions" value={loading ? '...' : questions.length} hint="Question bank size" accent="emerald" />
        <StatCard label="Students" value={loading ? '...' : students.length} hint="Registered learners" accent="amber" />
        <StatCard label="Schools" value={loading ? '...' : schools.length} hint="Institutional accounts" accent="white" />
        <StatCard label="Packages" value={loading ? '...' : packages.length} hint="Pricing plans created" accent="white" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Management Modules" subtitle="Open a module to edit content and control platform operations.">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Manage Subjects', 'Create and organize learning areas.', '/admin/subjects'],
              ['Manage Topics', 'Structure topics under each subject.', '/admin/topics'],
              ['Manage Questions', 'Create and maintain quiz items.', '/admin/questions'],
              ['Bulk Upload', 'Import questions faster in batches.', '/admin/bulk-upload'],
              ['Mock Builder', 'Assemble timed mock exams.', '/admin/mock-builder'],
              ['Students List', 'Review registered learners.', '/admin/students'],
              ['Manage Schools', 'Create school partner records.', '/admin/schools'],
              ['Manage Teachers', 'Maintain teacher onboarding records.', '/admin/teachers'],
              ['Manage Packages', 'Build pricing and access plans.', '/admin/packages'],
              ['Subscriptions', 'Assign packages to students.', '/admin/subscriptions'],
            ].map(([title, description, link]) => (
              <Link key={link} to={link} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <h3 className="text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                <p className="mt-4 text-sm font-semibold text-blue-700">Open Module →</p>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Performance Snapshot" subtitle="A quick overview of exam activity across the platform.">
          {loading ? (
            <LoadingState text="Loading performance data..." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Mock Exams</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{mockExams.length}</p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Average Score</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{averageScore}%</p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Pass Rate</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{passRate}%</p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Results Logged</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{results.length}</p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Teachers</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{teachers.length}</p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-sm text-slate-500">Active Assignments</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{assignments.filter((item) => item.status === 'ACTIVE').length}</p>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent Results" subtitle="Latest learner activity appearing across the system.">
        {loading ? (
          <LoadingState text="Loading recent results..." />
        ) : recentResults.length === 0 ? (
          <EmptyState title="No recent results" text="Once students submit quizzes, the newest results will appear here for admin review." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Topic</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((result) => {
                  const rawScore = Number(result.score || 0);
                  const rawTotal = Number(result.total || result.totalQuestions || 0);
                  const percent = rawTotal > 0 ? Math.round((rawScore / rawTotal) * 100) : rawScore;
                  const passed = percent >= 50;
                  return (
                    <tr key={result.id} className="border-b border-slate-100">
                      <td className="px-4 py-4 font-medium text-slate-900">{result.student?.name || result.user?.name || result.name || 'Student'}</td>
                      <td className="px-4 py-4 text-slate-700">{result.topic?.name || result.topicName || result.title || 'Topic'}</td>
                      <td className="px-4 py-4 text-slate-700">{percent}%</td>
                      <td className="px-4 py-4"><span className={`badge ${passed ? 'badge-success' : 'badge-warning'}`}>{passed ? 'Passed' : 'Needs work'}</span></td>
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
