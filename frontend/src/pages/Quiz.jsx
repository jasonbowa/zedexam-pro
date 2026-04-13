import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_ROOT, authFetch } from '../api';
import PageShell from '../components/PageShell';
import { LoadingState, Notice, ProgressBar, SectionCard } from '../components/ui';

export default function Quiz() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [topicName, setTopicName] = useState('Quiz');
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadQuiz = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await authFetch(`/quizzes/${topicId}`);
        const safe = Array.isArray(data) ? data : data?.questions || [];
        setQuestions(safe);
        setTopicName(data?.topic?.name || data?.topicTitle || data?.title || safe?.[0]?.topic?.name || 'Topic Quiz');
        setTimeLeft(10 * 60);
      } catch (err) {
        setError(err.message || 'Failed to load quiz.');
      } finally {
        setLoading(false);
      }
    };
    loadQuiz();
  }, [topicId]);

  useEffect(() => {
    if (!questions.length || submitting) return;
    if (timeLeft <= 0) {
      handleSubmitQuiz();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, questions.length, submitting]);

  const current = questions[currentIndex];
  const answeredCount = Object.values(answers).filter((v) => String(v || '').trim()).length;
  const progressPercent = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;
  const optionKeys = useMemo(() => ['optionA', 'optionB', 'optionC', 'optionD'], []);

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const resolveImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    return `${API_ROOT}${imageUrl}`;
  };

  const handleSelect = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const handleSubmitQuiz = async () => {
    if (submitting || !questions.length) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await authFetch('/results', {
        method: 'POST',
        body: JSON.stringify({
          topicId: Number(topicId),
          totalQuestions: questions.length,
          answers,
        }),
      });
      navigate(`/results/${result?.result?.id || result?.id}`);
    } catch (err) {
      setError(err.message || 'Failed to submit quiz.');
      setSubmitting(false);
    }
  };

  const renderAnswerInput = () => {
    if (!current) return null;
    const type = current.questionType || 'MCQ';

    if (type === 'SHORT_ANSWER' || type === 'STRUCTURED') {
      return (
        <textarea
          value={answers[current.id] || ''}
          onChange={(e) => handleSelect(current.id, e.target.value)}
          placeholder={type === 'STRUCTURED' ? 'Write your structured answer here...' : 'Write your answer here...'}
          className="min-h-[140px] w-full rounded-[24px] border border-slate-200 bg-white p-4 text-sm text-slate-900 outline-none ring-0 focus:border-slate-400"
        />
      );
    }

    return (
      <div className="space-y-3">
        {optionKeys
          .map((key) => current[key])
          .filter(Boolean)
          .map((opt, i) => {
            const selected = answers[current.id] === opt;
            return (
              <button
                key={`${current.id}-${i}`}
                type="button"
                onClick={() => handleSelect(current.id, opt)}
                className={`w-full rounded-[24px] border p-4 text-left text-sm font-medium transition ${
                  selected
                    ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-300/50'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-xs font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            );
          })}
      </div>
    );
  };

  return (
    <PageShell
      title={topicName}
      subtitle="Focus on one question at a time, watch the timer, and submit when you are done."
      action={<div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white">Time Left: {formatTime(timeLeft)}</div>}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loading ? (
        <LoadingState text="Loading quiz..." />
      ) : !current ? (
        <Notice tone="warning">No questions were found for this topic yet.</Notice>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
          <SectionCard title={`Question ${currentIndex + 1} of ${questions.length}`} subtitle={`Type: ${String(current.questionType || 'MCQ').replace(/_/g, ' ')}`}>
            <div className="space-y-5">
              {current.passage ? (
                <div className="rounded-[24px] border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-slate-700">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-blue-700">Passage / Scenario</p>
                  <p>{current.passage}</p>
                </div>
              ) : null}

              {current.imageUrl ? (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3">
                  <img src={resolveImageUrl(current.imageUrl)} alt="Question diagram" className="max-h-[320px] w-full rounded-[18px] object-contain" />
                </div>
              ) : null}

              <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-base font-semibold leading-8 text-slate-900">{current.question || current.text || 'Question text not available.'}</p>
              </div>

              {renderAnswerInput()}

              <div className="flex flex-wrap gap-3">
                <button className="btn btn-secondary" onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))} disabled={currentIndex === 0}>Previous</button>
                {currentIndex < questions.length - 1 ? (
                  <button className="btn btn-primary" onClick={() => setCurrentIndex((prev) => prev + 1)}>Next Question</button>
                ) : (
                  <button className="btn btn-success" onClick={handleSubmitQuiz} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Quiz'}</button>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Quiz Status" subtitle="Track completion before submitting.">
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                  <span>Progress</span>
                  <span className="font-semibold text-slate-900">{progressPercent}%</span>
                </div>
                <ProgressBar value={progressPercent} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">Answered</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{answeredCount}</p>
                </div>
                <div className="rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">Remaining</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{Math.max(questions.length - answeredCount, 0)}</p>
                </div>
              </div>

              <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Your answers are scored on the server when you submit. Short-answer and structured questions still rely on exact-answer matching unless a teacher reviews them later.
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </PageShell>
  );
}
