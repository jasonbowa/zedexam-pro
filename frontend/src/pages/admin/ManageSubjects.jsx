import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch, clearAuth, getStoredUser } from "../../api";

export default function ManageSubjects() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);

  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await authFetch("/subjects");
      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load subjects.");
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Subject name is required.");
      setSaving(false);
      return;
    }

    try {
      if (editingId) {
        await authFetch(`/subjects/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
          }),
        });
        setSuccess("Subject updated successfully.");
      } else {
        await authFetch("/subjects", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
          }),
        });
        setSuccess("Subject created successfully.");
      }

      resetForm();
      fetchSubjects();
    } catch (err) {
      setError(err.message || "Failed to save subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (subject) => {
    setEditingId(subject.id);
    setName(subject.name || "");
    setDescription(subject.description || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this subject?"
    );
    if (!confirmDelete) return;

    try {
      await authFetch(`/subjects/${id}`, {
        method: "DELETE",
      });
      setSuccess("Subject deleted successfully.");
      fetchSubjects();
    } catch (err) {
      setError(err.message || "Failed to delete subject.");
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  const adminName = user?.name || "Admin";

  return (
    <div style={pageShell}>
      <div style={container}>
        <header style={heroCard}>
          <div style={heroTop}>
            <div>
              <div style={eyebrow}>Admin Module</div>
              <h1 style={heroTitle}>Manage Subjects</h1>
              <p style={heroSubtitle}>
                Welcome, {adminName}. Create, update, and organize the subjects
                learners will study on the platform.
              </p>
            </div>

            <div style={heroActions}>
              <Link to="/admin" style={ghostLink}>
                Dashboard
              </Link>
              <Link to="/subjects" style={ghostLink}>
                Student View
              </Link>
              <button onClick={handleLogout} style={logoutButton}>
                Logout
              </button>
            </div>
          </div>

          <div style={heroStats}>
            <HeroStat title="Total Subjects" value={loading ? "..." : subjects.length} />
            <HeroStat title="Mode" value={editingId ? "Editing" : "Creating"} />
            <HeroStat title="Status" value={saving ? "Saving..." : "Ready"} />
          </div>
        </header>

        {error ? <Alert type="error" message={error} /> : null}
        {success ? <Alert type="success" message={success} /> : null}

        <div style={mainGrid}>
          <section style={panelCard}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>
                  {editingId ? "Edit Subject" : "Add New Subject"}
                </h2>
                <p style={sectionSubtitle}>
                  Use this form to create or update a subject.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={formGrid}>
              <div>
                <label style={label}>Subject Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mathematics"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={input}
                />
              </div>

              <div>
                <label style={label}>Description</label>
                <textarea
                  placeholder="Write a short subject description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={textarea}
                />
              </div>

              <div style={buttonRow}>
                <button type="submit" style={primaryButton} disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Subject"
                    : "Create Subject"}
                </button>

                {editingId ? (
                  <button type="button" onClick={resetForm} style={secondaryButton}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section style={panelCard}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>All Subjects</h2>
                <p style={sectionSubtitle}>
                  Review, edit, or remove available subjects.
                </p>
              </div>
            </div>

            {loading ? (
              <div style={emptyState}>Loading subjects...</div>
            ) : subjects.length === 0 ? (
              <div style={emptyState}>No subjects found.</div>
            ) : (
              <div style={subjectList}>
                {subjects.map((subject, index) => (
                  <div key={subject.id} style={subjectCard}>
                    <div style={subjectTop}>
                      <div style={subjectIcon}>
                        {String(subject.name || "S").charAt(0).toUpperCase()}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={subjectNameRow}>
                          <h3 style={subjectTitle}>
                            {subject.name || "Untitled Subject"}
                          </h3>
                          <span style={subjectIndex}>#{index + 1}</span>
                        </div>

                        <p style={subjectDescription}>
                          {subject.description || "No description provided yet."}
                        </p>
                      </div>
                    </div>

                    <div style={subjectActions}>
                      <button
                        onClick={() => handleEdit(subject)}
                        style={editButton}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDelete(subject.id)}
                        style={deleteButton}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ title, value }) {
  return (
    <div style={heroStatCard}>
      <div style={heroStatTitle}>{title}</div>
      <div style={heroStatValue}>{value}</div>
    </div>
  );
}

function Alert({ type, message }) {
  return (
    <div
      style={{
        ...alertBase,
        background: type === "error" ? "rgba(127, 29, 29, 0.92)" : "rgba(22, 101, 52, 0.92)",
        border:
          type === "error"
            ? "1px solid rgba(248,113,113,0.3)"
            : "1px solid rgba(74,222,128,0.28)",
      }}
    >
      {message}
    </div>
  );
}

const pageShell = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #020617, #0f172a, #1e293b)",
  padding: "24px 16px 40px",
  fontFamily:
    "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container = {
  maxWidth: "1280px",
  margin: "0 auto",
};

const heroCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "28px",
  padding: "26px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  marginBottom: "20px",
};

const heroTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
};

const eyebrow = {
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  color: "#93c5fd",
  fontWeight: "800",
  marginBottom: "8px",
};

const heroTitle = {
  margin: 0,
  fontSize: "34px",
  color: "#ffffff",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

const heroSubtitle = {
  margin: "10px 0 0",
  color: "rgba(255,255,255,0.75)",
  fontSize: "15px",
  lineHeight: 1.7,
  maxWidth: "760px",
};

const heroActions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const ghostLink = {
  textDecoration: "none",
  padding: "11px 15px",
  borderRadius: "12px",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.12)",
  fontWeight: "700",
};

const logoutButton = {
  padding: "11px 15px",
  borderRadius: "12px",
  background: "transparent",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.24)",
  fontWeight: "700",
  cursor: "pointer",
};

const heroStats = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginTop: "24px",
};

const heroStatCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "18px",
  padding: "16px",
};

const heroStatTitle = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.68)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: "700",
  marginBottom: "8px",
};

const heroStatValue = {
  fontSize: "26px",
  color: "#ffffff",
  fontWeight: "800",
};

const alertBase = {
  color: "#ffffff",
  padding: "14px 16px",
  borderRadius: "16px",
  marginBottom: "16px",
  fontWeight: "700",
  boxShadow: "0 14px 30px rgba(0,0,0,0.16)",
};

const mainGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1.1fr",
  gap: "20px",
};

const panelCard = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "24px",
  boxShadow: "0 20px 46px rgba(0,0,0,0.18)",
  border: "1px solid #e2e8f0",
};

const sectionHeader = {
  marginBottom: "18px",
};

const sectionTitle = {
  margin: 0,
  fontSize: "24px",
  color: "#0f172a",
  fontWeight: "800",
};

const sectionSubtitle = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: "14px",
  lineHeight: 1.6,
};

const formGrid = {
  display: "grid",
  gap: "16px",
};

const label = {
  display: "block",
  marginBottom: "8px",
  color: "#334155",
  fontSize: "14px",
  fontWeight: "700",
};

const input = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid #cbd5e1",
  fontSize: "15px",
  outline: "none",
  boxSizing: "border-box",
  background: "#f8fafc",
};

const textarea = {
  ...input,
  minHeight: "110px",
  resize: "vertical",
};

const buttonRow = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButton = {
  padding: "13px 18px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#ffffff",
  fontWeight: "800",
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(37,99,235,0.25)",
};

const secondaryButton = {
  padding: "13px 18px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: "700",
  cursor: "pointer",
};

const emptyState = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "18px",
  color: "#64748b",
  fontSize: "14px",
};

const subjectList = {
  display: "grid",
  gap: "14px",
};

const subjectCard = {
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  padding: "18px",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
};

const subjectTop = {
  display: "flex",
  gap: "14px",
  alignItems: "flex-start",
};

const subjectIcon = {
  width: "54px",
  height: "54px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  display: "grid",
  placeItems: "center",
  fontWeight: "800",
  color: "#ffffff",
  fontSize: "20px",
  flexShrink: 0,
  boxShadow: "0 12px 24px rgba(37,99,235,0.22)",
};

const subjectNameRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const subjectTitle = {
  margin: 0,
  fontSize: "20px",
  color: "#0f172a",
  fontWeight: "800",
};

const subjectIndex = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: "800",
};

const subjectDescription = {
  margin: "10px 0 0",
  color: "#64748b",
  fontSize: "14px",
  lineHeight: 1.7,
};

const subjectActions = {
  marginTop: "16px",
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const editButton = {
  padding: "11px 14px",
  border: "none",
  borderRadius: "12px",
  background: "#0ea5e9",
  color: "#ffffff",
  fontWeight: "800",
  cursor: "pointer",
};

const deleteButton = {
  padding: "11px 14px",
  border: "none",
  borderRadius: "12px",
  background: "#ef4444",
  color: "#ffffff",
  fontWeight: "800",
  cursor: "pointer",
};