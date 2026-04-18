import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../../api";

const gradeOptions = [
  { value: "FORM_1", label: "FORM 1" },
  { value: "FORM_2", label: "FORM 2" },
  { value: "FORM_3", label: "FORM 3" },
  { value: "FORM_4", label: "FORM 4" },
  { value: "GRADE_10", label: "GRADE 10" },
  { value: "GRADE_11", label: "GRADE 11" },
  { value: "GRADE_12", label: "GRADE 12" },
];

const emptyForm = {
  name: "",
  grade: "FORM_1",
  description: "",
};

export default function ManageSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const loadSubjects = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await authFetch("/subjects");
      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load subjects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const filteredSubjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return subjects;

    return subjects.filter((subject) => {
      const name = String(subject.name || "").toLowerCase();
      const grade = String(subject.grade || "").toLowerCase();
      const description = String(subject.description || "").toLowerCase();
      return (
        name.includes(term) ||
        grade.includes(term) ||
        description.includes(term)
      );
    });
  }, [subjects, search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (subject) => {
    setError("");
    setSuccess("");
    setEditingId(subject.id);
    setForm({
      name: subject.name || "",
      grade: subject.grade || "FORM_1",
      description: subject.description || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (subjectId) => {
    const confirmed = window.confirm("Delete this subject?");
    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await authFetch(`/subjects/${subjectId}`, {
        method: "DELETE",
      });

      setSuccess("Subject deleted successfully.");
      if (editingId === subjectId) {
        resetForm();
      }
      await loadSubjects();
    } catch (err) {
      setError(err.message || "Failed to delete subject.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("Subject name is required.");
      return;
    }

    if (!form.grade) {
      setError("Grade is required.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        grade: form.grade,
        description: form.description.trim(),
      };

      if (editingId) {
        await authFetch(`/subjects/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Subject updated successfully.");
      } else {
        await authFetch("/subjects", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Subject created successfully.");
      }

      resetForm();
      await loadSubjects();
    } catch (err) {
      setError(err.message || "Failed to save subject.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
              Admin panel
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Manage Subjects
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Create, update, and delete subjects using the same grade values your
              backend expects.
            </p>
          </div>

          <button
            type="button"
            onClick={resetForm}
            className="btn border border-slate-300 bg-white text-slate-900"
          >
            {editingId ? "Cancel Edit" : "Reset Form"}
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Subject Name
            </label>
            <input
              className="input h-12"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Mathematics"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Grade
            </label>
            <select
              className="input h-12"
              value={form.grade}
              onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
            >
              {gradeOptions.map((grade) => (
                <option key={grade.value} value={grade.value}>
                  {grade.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Description
            </label>
            <textarea
              className="input min-h-[120px] py-3"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional description for the subject"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving
                ? editingId
                  ? "Updating..."
                  : "Creating..."
                : editingId
                ? "Update Subject"
                : "Create Subject"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="btn border border-slate-300 bg-white text-slate-900"
            >
              Clear
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Subject List
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Review and manage available subjects.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <input
              className="input h-12"
              placeholder="Search by subject, grade, or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Loading subjects...
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No subjects found yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredSubjects.map((subject) => (
                <div
                  key={subject.id}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">
                        {subject.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {String(subject.grade || "").replace(/_/g, " ")}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {subject.description?.trim()
                          ? subject.description
                          : "No description provided."}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn border border-slate-300 bg-white text-slate-900"
                        onClick={() => startEdit(subject)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn border border-red-200 bg-red-50 text-red-700"
                        onClick={() => handleDelete(subject.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}