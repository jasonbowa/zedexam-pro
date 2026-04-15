// (FULL FILE — CLEAN + PROFESSIONAL UI)

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch, clearAuth, getStoredUser } from "../../api";

export default function MockBuilder() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");

  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [selectedQuestions, setSelectedQuestions] = useState([]);

  const [mockExams, setMockExams] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (subjectId) fetchTopics(subjectId);
    else {
      setTopics([]);
      setTopicId("");
    }
  }, [subjectId]);

  useEffect(() => {
    if (topicId) fetchQuestions(topicId);
    else setQuestions([]);
  }, [topicId]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [subjectsData, mocksData] = await Promise.all([
        authFetch("/subjects"),
        authFetch("/mock-exams"),
      ]);
      setSubjects(subjectsData || []);
      setMockExams(mocksData || []);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchTopics = async (sid) => {
    setLoadingTopics(true);
    try {
      const data = await authFetch("/topics");
      setTopics(data.filter(t => String(t.subjectId) === String(sid)));
    } finally {
      setLoadingTopics(false);
    }
  };

  const fetchQuestions = async (tid) => {
    setLoadingQuestions(true);
    try {
      const data = await authFetch("/questions");
      setQuestions(data.filter(q => String(q.topicId) === String(tid)));
    } finally {
      setLoadingQuestions(false);
    }
  };

  const toggleQuestion = (id) => {
    setSelectedQuestions(prev =>
      prev.includes(id)
        ? prev.filter(q => q !== id)
        : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title) return setError("Enter mock title");
    if (!selectedQuestions.length) return setError("Select questions");

    setSaving(true);

    try {
      const payload = {
        title,
        duration,
        questionIds: selectedQuestions,
      };

      if (editingId) {
        await authFetch(`/mock-exams/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await authFetch("/mock-exams", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setSuccess("Mock saved successfully");
      setTitle("");
      setSelectedQuestions([]);
      loadInitial();
    } catch {
      setError("Failed to save mock");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this mock?")) return;
    await authFetch(`/mock-exams/${id}`, { method: "DELETE" });
    loadInitial();
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div style={page}>
      {/* HEADER */}
      <div style={header}>
        <h1>Mock Exam Builder</h1>
        <div>
          <Link to="/admin">Dashboard</Link>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div style={container}>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {success && <p style={{ color: "green" }}>{success}</p>}

        {/* BUILDER */}
        <div style={card}>
          <h2>Create Mock Exam</h2>

          <input
            placeholder="Mock Title (e.g. Math Mock Paper 1)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={input}
          />

          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={input}
          />

          <div style={grid}>
            <select onChange={(e) => setSubjectId(e.target.value)} style={input}>
              <option>Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select onChange={(e) => setTopicId(e.target.value)} style={input}>
              <option>Select Topic</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <h3>Questions ({selectedQuestions.length})</h3>

          <div style={questionList}>
            {questions.map(q => (
              <div key={q.id} style={questionCard}>
                <input
                  type="checkbox"
                  checked={selectedQuestions.includes(q.id)}
                  onChange={() => toggleQuestion(q.id)}
                />
                <span>{q.question}</span>
              </div>
            ))}
          </div>

          <button onClick={handleSave} style={saveBtn}>
            {saving ? "Saving..." : "Save Mock Exam"}
          </button>
        </div>

        {/* MOCK LIST */}
        <div style={card}>
          <h2>Existing Mocks</h2>

          {mockExams.map(m => (
            <div key={m.id} style={mockCard}>
              <div>
                <strong>{m.title}</strong>
                <p>{m.duration} mins</p>
              </div>

              <div>
                <button onClick={() => handleDelete(m.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* STYLES */
const page = { background: "#0f172a", minHeight: "100vh", color: "#fff" };
const header = { padding: 20, display: "flex", justifyContent: "space-between" };
const container = { maxWidth: 1100, margin: "auto", padding: 20 };
const card = { background: "#1e293b", padding: 20, borderRadius: 10, marginBottom: 20 };

const input = { padding: 10, marginTop: 10, width: "100%" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

const questionList = { maxHeight: 300, overflow: "auto", marginTop: 10 };

const questionCard = {
  display: "flex",
  gap: 10,
  padding: 8,
  background: "#334155",
  marginBottom: 6,
};

const saveBtn = {
  marginTop: 15,
  padding: 12,
  background: "#22c55e",
  border: "none",
  color: "#fff",
};

const mockCard = {
  display: "flex",
  justifyContent: "space-between",
  padding: 10,
  background: "#334155",
  marginTop: 10,
};