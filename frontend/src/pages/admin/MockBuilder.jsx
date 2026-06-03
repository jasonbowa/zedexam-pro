import { useEffect, useMemo, useState } from 'react';
import PageShell from '../../components/PageShell';
import { authFetch } from '../../api';
import { EmptyState, LoadingState, Notice } from '../../components/ui';
import { AdminCard, FormInput, FormSelect, FormTextarea, PrimaryButton } from '../../components/forms';

export default function MockBuilder() {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [mockExams, setMockExams] = useState([]);

  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [selectedQuestions, setSelectedQuestions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedSubject = useMemo(
    () => subjects.find((subject) => String(subject.id) === String(subjectId)),
    [subjects, subjectId]
  );
  const selectedTopic = useMemo(
    () => topics.find((topic) => String(topic.id) === String(topicId)),
    [topics, topicId]
  );

  const loadInitial = async () => {
    setLoading(true);
    setError('');
    try {
      const [subjectsData, mocksData] = await Promise.all([
        authFetch('/subjects'),
        authFetch('/mock-exams'),
      ]);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setMockExams(Array.isArray(mocksData) ? mocksData : []);
    } catch (err) {
      setError(err.message || 'Failed to load Mock Builder data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInitial(); }, []);

  useEffect(() => {
    const loadTopics = async () => {
      if (!subjectId) {
        setTopics([]);
        setTopicId('');
        return;
      }

      setLoadingTopics(true);
      setError('');
      try {
        let data;
        try {
          data = await authFetch(`/subjects/${subjectId}/topics`);
        } catch {
          const allTopics = await authFetch('/topics');
          data = Array.isArray(allTopics)
            ? allTopics.filter((topic) => String(topic.subjectId || topic.subject?.id || '') === String(subjectId))
            : [];
        }
        setTopics(Array.isArray(data) ? data : []);
        setTopicId('');
      } catch (err) {
        setTopics([]);
        setError(err.message || 'Failed to load topics for the selected subject.');
      } finally {
        setLoadingTopics(false);
      }
    };

    loadTopics();
  }, [subjectId]);

  useEffect(() => {
    const loadQuestions = async () => {
      if (!topicId) {
        setQuestions([]);
        setSelectedQuestions([]);
        return;
      }

      setLoadingQuestions(true);
      setError('');
      try {
        let data;
        try {
          data = await authFetch(`/questions/topic/${topicId}`);
        } catch {
          const allQuestions = await authFetch('/questions');
          data = Array.isArray(allQuestions)
            ? allQuestions.filter((question) => String(question.topicId || question.topic?.id || '') === String(topicId))
            : [];
        }
        setQuestions(Array.isArray(data) ? data : []);
        setSelectedQuestions([]);
      } catch (err) {
        setQuestions([]);
        setError(err.message || 'Failed to load questions for the selected topic.');
      } finally {
        setLoadingQuestions(false);
      }
    };

    loadQuestions();
  }, [topicId]);

  const toggleQuestion = (id) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((questionId) => questionId !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setTitle('');
    setInstructions('');
    setDurationMinutes(30);
    setSelectedQuestions([]);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim()) return setError('Mock exam title is required.');
    if (!subjectId) return setError('Please select a subject.');
    if (!topicId) return setError('Please select a topic.');
    if (Number(durationMinutes) < 1) return setError('Duration must be at least 1 minute.');
    if (!selectedQuestions.length) return setError('Select at least one question for this mock exam.');

    setSaving(true);
    try {
      await authFetch('/mock-exams', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          instructions: instructions.trim(),
          durationMinutes: Number(durationMinutes),
          subjectId: Number(subjectId),
          topicId: Number(topicId),
          questionIds: selectedQuestions.map(Number),
        }),
      });

      setSuccess('Mock exam created successfully.');
      resetForm();
      await loadInitial();
    } catch (err) {
      setError(err.message || 'Failed to save mock exam.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this mock exam?')) return;
    setError('');
    setSuccess('');
    try {
      await authFetch(`/mock-exams/${id}`, { method: 'DELETE' });
      setSuccess('Mock exam deleted successfully.');
      await loadInitial();
    } catch (err) {
      setError(err.message || 'Failed to delete mock exam.');
    }
  };

  return (
    <PageShell
      title="Mock Exam Builder"
      subtitle="Create timed mock exams from existing question-bank items with readable, reliable admin controls."
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminCard
          title="Create Mock Exam"
          subtitle="Choose the subject, topic, duration, and the exact questions learners should attempt."
        >
          <form className="grid gap-4" onSubmit={handleSave}>
            <FormInput
              label="Mock Exam Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Mathematics Mock Paper 1"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                label="Duration (minutes)"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
              <FormSelect label="Subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={loading}>
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </FormSelect>
            </div>

            <FormSelect
              label="Topic"
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
              disabled={!subjectId || loadingTopics}
            >
              <option value="">{loadingTopics ? 'Loading topics...' : subjectId ? 'Select topic' : 'Select subject first'}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>{topic.title || topic.name}</option>
              ))}
            </FormSelect>

            <FormTextarea
              label="Instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Optional exam instructions shown to learners before they start."
              rows={3}
            />

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold text-slate-950">Question Selection</h3>
                  <p className="text-sm text-slate-500">
                    {selectedSubject?.name || 'No subject'} / {selectedTopic?.title || selectedTopic?.name || 'No topic'}.
                  </p>
                </div>
                <span className="badge badge-info">{selectedQuestions.length} selected</span>
              </div>

              <div className="mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
                {loadingQuestions ? <LoadingState text="Loading questions..." /> : null}
                {!loadingQuestions && !topicId ? (
                  <EmptyState title="Select a topic" text="Questions will appear after you select a subject and topic." />
                ) : null}
                {!loadingQuestions && topicId && questions.length === 0 ? (
                  <EmptyState title="No questions found" text="Add questions to this topic before creating a mock exam." />
                ) : null}
                {!loadingQuestions && questions.map((question) => {
                  const checked = selectedQuestions.includes(question.id);
                  return (
                    <label
                      key={question.id}
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 text-sm transition ${
                        checked ? 'border-blue-300 bg-blue-50 text-slate-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-blue-700"
                        checked={checked}
                        onChange={() => toggleQuestion(question.id)}
                      />
                      <span className="leading-6">{question.question}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <PrimaryButton type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Mock Exam'}</PrimaryButton>
              <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving}>Reset</button>
            </div>
          </form>
        </AdminCard>

        <AdminCard title="Existing Mock Exams" subtitle="Review and remove mock exams without touching the question bank.">
          {loading ? <LoadingState text="Loading mock exams..." /> : null}
          {!loading && mockExams.length === 0 ? (
            <EmptyState title="No mock exams yet" text="Create the first mock exam from selected questions." />
          ) : (
            <div className="space-y-4">
              {mockExams.map((mock) => (
                <div key={mock.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-bold text-slate-950">{mock.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {mock.subject?.name || 'Subject'} / {mock.topic?.title || 'Topic'} / {mock.durationMinutes || mock.duration || 0} minutes
                      </p>
                      <p className="mt-2 text-sm text-slate-600">{mock.totalQuestions || mock.questionsCount || 0} question(s)</p>
                    </div>
                    <button type="button" className="btn border border-red-200 bg-red-50 text-red-700" onClick={() => handleDelete(mock.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      </div>
    </PageShell>
  );
}
