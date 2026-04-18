import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../api";
import PageShell from "../components/PageShell";
import { EmptyState, LoadingState, Notice, SectionCard } from "../components/ui";

const normalizeSubjects = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.subjects)) return value.subjects;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.data?.subjects)) return value.data.subjects;
  return [];
};

const getSubjectName = (subject) => {
  return subject?.name || subject?.title || subject?.subjectName || "Subject";
};

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSubjects = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await authFetch("/subjects");
        setSubjects(normalizeSubjects(data));
      } catch (err) {
        setError(err.message || "Failed to load subjects.");
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return subjects;

    return subjects.filter((subject) =>
      `${getSubjectName(subject)} ${subject.description || ""} ${subject.grade || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [search, subjects]);

  return (
    <PageShell
      title="Subjects"
      subtitle="Browse the learning areas available on the platform and jump straight into topic-based practice."
      action={
        <input
          className="input h-11 min-w-[260px] bg-white"
          placeholder="Search subjects"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      }
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <SectionCard
        title="All Learning Areas"
        subtitle={`${filtered.length} subject(s) available for practice.`}
      >
        {loading ? (
          <LoadingState text="Loading subjects..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matching subjects"
            text="Try another search term or add subjects from the admin panel."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((subject) => (
              <Link
                key={subject.id}
                to={`/subjects/${subject.id}`}
                className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-950 to-blue-700 text-xl font-black text-white">
                    {String(getSubjectName(subject)).charAt(0).toUpperCase()}
                  </div>
                  <span className="badge badge-info">Study</span>
                </div>

                <h3 className="mt-4 text-xl font-bold text-slate-950">
                  {getSubjectName(subject)}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {subject.description ||
                    "Topic practice, quizzes, revision, and exam preparation."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {subject.grade ? (
                    <span className="badge badge-neutral">
                      {String(subject.grade).replace(/_/g, " ")}
                    </span>
                  ) : null}
                  {subject.accessPlan ? (
                    <span className="badge badge-success">
                      {subject.accessPlan}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between text-sm font-semibold text-blue-700">
                  <span>Open subject</span>
                  <span>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}