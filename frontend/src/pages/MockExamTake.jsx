import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { EmptyState, LoadingState, Notice, SectionCard, StatCard } from '../components/ui';
import { api, firstSuccessfulRequest } from '../lib/api';

function normalizeQuestion(question, index) {
  return {
    id: question.id ?? `${index + 1}`,
    question: question.question || question.text || `Question ${index + 1}`,
    optionA: question.optionA || question.a || question.options?.A || question.options?.[0] || '',
    optionB: question.optionB || question.b || question.options?.B || question.options?.[1] || '',
    optionC: question.optionC || question.c || question.options?.C || question.options?.[2] || '',
    optionD: question.optionD || question.d || question.options?.D || question.options?.[3] || '',
    marks: Number(question.marks || 1),
  };
}

export default function MockExamTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');

        const response = await firstSuccessfulRequest([
          () => api.get(`/mock-exams/${id}`),
          async () => {
            const listResponse = await api.get('/mock-exams');
            const rows = Array.isArray(listResponse.data) ? listResponse.data : [];
            const match = rows.find((row) => String(row.id) === String(id));
            if (!match) {
              throw new Error('Mock exam not found.');
            }
            return { data: match };
          },
        ]);

        const payload = response.data || {};
        const examData = payload.exam || payload;
        const examQuestions = Array.isArray(payload.questions)
          ? payload.questions
          : Array.isArray(examData.questions)
            ? examData.questions
            : [];

        setExam(examData);
        setQuestions(examQuestions.map(normalizeQuestion).filter((item) => item.question));
        setAnswers({});
        setCurrentIndex(0);
      } catch (err) {
        setError(err.message || 'Failed to load mock exam.');
        setExam(null);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const currentQuestion = useMemo(() => questions[currentIndex] || null, [questions, currentIndex]);
  const totalMarks = useMemo(() => questions.reduce((sum, item) => sum + Number(item.marks || 1), 0), [questions]);

  const handleSubmit = async () => {
    if (!questions.length) return;

    try {
      setSubmitting(true);
      setError('');

      const response = await firstSuccessfulRequest([
        () => api.post('/results', {
          mockExamId: Number(id),
          totalQuestions: questions.length,
          answers,
        }),
      ]);

      const resultId = response?.data?.result?.id || response?.data?.id;
      if (!resultId) {
        throw new Error('Result was not returned after submission.');
      }

      navigate(`/results/${resultId}`);
    } catch (err) {
      setError(err.message || 'Failed to submit mock exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const options = currentQuestion
    ? [
        ['A', currentQuestion.optionA],
        ['B', currentQuestion.optionB],
        ['C', currentQuestion.optionC],
        ['D', currentQuestion.optionD],
      ].filter(([, value]) => value)
    : [];

  return (
    <PageShell
      title={exam?.title || 'Mock Exam'}
      subtitle={exam?.instructions || 'Complete the full mock paper and submit when finished.'}
      action={<button onClick={() => navigate('/mock-exams')} className="btn btn-secondary">Back to Mock Exams</button>}
    >
      {!loading && !error && questions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Question" value={`${currentIndex + 1}/${questions.length}`} hint="Current progress" />
          <StatCard label="Answered" value={Object.keys(answers).length} hint="Responses selected" />
          <StatCard label="Duration" value={`${exam?.durationMinutes || exam?.duration || '—'} min`} hint="Allocated time" />
          <StatCard label="Total Marks" value={totalMarks} hint="Scoring weight" />
        </div>
      ) : null}

      <SectionCard title="Mock Exam Workspace" subtitle="Your answers stay in memory until you submit this mock paper.">
        {loading ? <LoadingState text="Loading mock exam..." /> : null}
        {!loading && error ? <Notice tone="danger">{error}</Notice> : null}
        {!loading && !error && questions.length === 0 ? (
          <EmptyState
            title="This mock exam has no questions yet"
            text="Attach questions in the admin mock builder, then reopen this paper."
          />
        ) : null}

        {!loading && !error && currentQuestion ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600">Question {currentIndex + 1}</p>
              <h3 className="mt-3 text-xl font-bold leading-8 text-slate-950">{currentQuestion.question}</h3>
            </div>

            <div className="grid gap-3">
              {options.map(([label, value]) => {
                const selected = answers[currentQuestion.id] === value;
                return (
                  <label
                    key={label}
                    className={`cursor-pointer rounded-3xl border p-4 transition ${selected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        className="mt-1"
                        checked={selected}
                        onChange={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))}
                      />
                      <div>
                        <p className="font-semibold text-slate-900">Option {label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{value}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))} disabled={currentIndex === 0} className="btn btn-secondary disabled:opacity-50">Previous</button>
              {currentIndex < questions.length - 1 ? (
                <button onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))} className="btn btn-primary">Next</button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="btn btn-success disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit Mock Exam'}</button>
              )}
            </div>
          </div>
        ) : null}
      </SectionCard>
    </PageShell>
  );
}
