import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch, clearAuth, getStoredUser } from "../api";

export default function MockExams() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);

  const [mockExams, setMockExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMockExams();
  }, []);

  const loadMockExams = async () => {
    setLoading(true);
    setError("");

    try {
      const [mockData, resultsData] = await Promise.allSettled([
        authFetch("/mock-exams"),
        authFetch("/results/my-results"),
      ]);

      setMockExams(
        mockData.status === "fulfilled" && Array.isArray(mockData.value)
          ? mockData.value
          : []
      );

      setResults(
        resultsData.status === "fulfilled" && Array.isArray(resultsData.value)
          ? resultsData.value
          : []
      );
    } catch (err) {
      setError(err.message || "Failed to load mock exams.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  const firstName = user?.name ? user.name.split(" ")[0] : "Student";
  const isAdmin = user?.role === "admin" || user?.isAdmin === true;

  const getMockStats = (mockId) => {
    const related = results.filter(
      (r) =>
        String(r.mockExamId || r.mock?.id || "") === String(mockId)
    );

    if (!related.length) {
      return {
        attempts: 0,
        bestScore: 0,
        latestResultId: null,
      };
    }

    let bestScore = 0;
    let latestResultId = null;

    related.forEach((item) => {
      const rawScore = Number(item.score || 0);
      const rawTotal = Number(item.total || item.totalQuestions || 0);
      const percent = rawTotal > 0 ? Math.round((rawScore / rawTotal) * 100) : rawScore;

      bestScore = Math.max(bestScore, percent);
      latestResultId = item.id;
    });

    return {
      attempts: related.length,
      bestScore,
      latestResultId,
    };
  };

  return (
    <div style={pageShell}>
      <div style={container}>
        <header style={heroCard}>
          <div style={heroTop}>
            <div>
              <div style={eyebrow}>Exam Simulation</div>
              <h1 style={heroTitle}>Mock Exams</h1>
              <p style={heroSubtitle}>
                Welcome, {firstName}. Take timed mock exams to build exam confidence and improve your performance under pressure.
              </p>
            </div>

            <div style={heroActions}>
              <Link to="/dashboard" style={ghostLink}>
                Dashboard
              </Link>
              <Link to="/subjects" style={ghostLink}>
                Subjects
              </Link>
              {isAdmin ? (
                <Link to="/admin" style={adminLink}>
                  Admin
                </Link>
              ) : null}
              <button type="button" onClick={handleLogout} style={logoutButton}>
                Logout
              </button>
            </div>
          </div>

          <div style={heroStatsGrid}>
            <HeroStat
              title="Available Mocks"
              value={loading ? "..." : mockExams.length}
            />
            <HeroStat
              title="Completed Attempts"
              value={loading ? "..." : results.filter((r) => r.mockExamId || r.mock?.id).length}
            />
            <HeroStat
              title="Best Mock Score"
              value={
                loading
                  ? "..."
                  : `${results.reduce((best, item) => {
                      const rawScore = Number(item.score || 0);
                      const rawTotal = Number(item.total || item.totalQuestions || 0);
                      const percent = rawTotal > 0 ? Math.round((rawScore / rawTotal) * 100) : rawScore;
                      return Math.max(best, percent);
                    }, 0)}%`
              }
            />
          </div>
        </header>

        {error ? <div style={inlineError}>{error}</div> : null}

        <section style={panelCard}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Available Mock Exams</h2>
              <p style={sectionSubtitle}>
                Choose a mock exam and test your readiness in a timed environment.
              </p>
            </div>
          </div>

          {loading ? (
            <div style={emptyState}>Loading mock exams...</div>
          ) : mockExams.length === 0 ? (
            <div style={emptyState}>No mock exams available yet.</div>
          ) : (
            <div style={mockGrid}>
              {mockExams.map((mock) => {
                const stats = getMockStats(mock.id);
                const passed = stats.bestScore >= 50;

                return (
                  <div key={mock.id} style={mockCard}>
                    <div style={mockTop}>
                      <div style={mockIcon}>M</div>

                      <div style={{ flex: 1 }}>
                        <h3 style={mockTitle}>{mock.title || "Mock Exam"}</h3>
                        <p style={mockText}>
                          {mock.description || "Timed practice exam designed to simulate real exam conditions."}
                        </p>
                      </div>
                    </div>

                    <div style={metaGrid}>
                      <div style={metaBox}>
                        <span style={metaLabel}>Duration</span>
                        <strong style={metaValue}>
                          {mock.duration || 30} mins
                        </strong>
                      </div>

                      <div style={metaBox}>
                        <span style={metaLabel}>Questions</span>
                        <strong style={metaValue}>
                          {Array.isArray(mock.questions)
                            ? mock.questions.length
                            : Array.isArray(mock.questionIds)
                            ? mock.questionIds.length
                            : mock.totalQuestions || "-"}
                        </strong>
                      </div>

                      <div style={metaBox}>
                        <span style={metaLabel}>Attempts</span>
                        <strong style={metaValue}>{stats.attempts}</strong>
                      </div>

                      <div style={metaBox}>
                        <span style={metaLabel}>Best Score</span>
                        <strong style={metaValue}>{stats.bestScore}%</strong>
                      </div>
                    </div>

                    <div style={badgeRow}>
                      <span
                        style={{
                          ...statusBadge,
                          background:
                            stats.attempts === 0
                              ? "#334155"
                              : passed
                              ? "#166534"
                              : "#991b1b",
                        }}
                      >
                        {stats.attempts === 0
                          ? "Not Attempted"
                          : passed
                          ? "Passed"
                          : "Needs Work"}
                      </span>
                    </div>

                    <div style={actionRow}>
                      <Link to={`/mock-exam/${mock.id}`} style={startButton}>
                        Start Mock
                      </Link>

                      {stats.latestResultId ? (
                        <Link
                          to={`/results/${stats.latestResultId}`}
                          style={resultButton}
                        >
                          View Result
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={focusCard}>
          <h2 style={focusTitle}>Why Mock Exams Matter</h2>
          <p style={focusText}>
            Mock exams help you practice under time pressure, improve speed, and discover weak areas before the real exam.
          </p>
        </section>
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
  marginBottom: "22px",
};

const heroTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  alignItems: "flex-start",
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

const adminLink = {
  textDecoration: "none",
  padding: "11px 15px",
  borderRadius: "12px",
  background: "#f59e0b",
  color: "#111827",
  fontWeight: "800",
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

const heroStatsGrid = {
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

const inlineError = {
  marginBottom: "18px",
  background: "rgba(127, 29, 29, 0.92)",
  color: "#ffffff",
  padding: "14px 16px",
  borderRadius: "16px",
  border: "1px solid rgba(248,113,113,0.3)",
  fontWeight: "700",
};

const panelCard = {
  background: "#ffffff",
  borderRadius: "24px",
  padding: "24px",
  boxShadow: "0 20px 46px rgba(0,0,0,0.18)",
  border: "1px solid #e2e8f0",
  marginBottom: "20px",
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

const emptyState = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "18px",
  color: "#64748b",
  fontSize: "14px",
};

const mockGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "18px",
};

const mockCard = {
  border: "1px solid #e2e8f0",
  borderRadius: "22px",
  padding: "20px",
  background: "#ffffff",
  boxShadow: "0 12px 24px rgba(15,23,42,0.06)",
};

const mockTop = {
  display: "flex",
  gap: "14px",
  alignItems: "flex-start",
};

const mockIcon = {
  width: "56px",
  height: "56px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  display: "grid",
  placeItems: "center",
  fontWeight: "800",
  color: "#ffffff",
  fontSize: "22px",
  boxShadow: "0 12px 24px rgba(37,99,235,0.22)",
  flexShrink: 0,
};

const mockTitle = {
  margin: 0,
  fontSize: "20px",
  color: "#0f172a",
  fontWeight: "800",
};

const mockText = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: "14px",
  lineHeight: 1.7,
};

const metaGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  marginTop: "16px",
};

const metaBox = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "12px",
};

const metaLabel = {
  display: "block",
  color: "#64748b",
  fontSize: "12px",
  marginBottom: "6px",
  fontWeight: "700",
};

const metaValue = {
  color: "#0f172a",
  fontSize: "18px",
  fontWeight: "800",
};

const badgeRow = {
  marginTop: "14px",
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const statusBadge = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "999px",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: "800",
  letterSpacing: "0.03em",
};

const actionRow = {
  marginTop: "18px",
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const startButton = {
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#ffffff",
  padding: "12px 14px",
  borderRadius: "12px",
  fontWeight: "800",
  boxShadow: "0 12px 24px rgba(37,99,235,0.22)",
};

const resultButton = {
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "12px 14px",
  borderRadius: "12px",
  fontWeight: "800",
};

const focusCard = {
  borderRadius: "24px",
  padding: "24px",
  background: "linear-gradient(135deg, #1d4ed8, #0f172a)",
  color: "#ffffff",
  boxShadow: "0 20px 46px rgba(0,0,0,0.22)",
};

const focusTitle = {
  margin: "0 0 10px",
  fontSize: "24px",
  fontWeight: "800",
};

const focusText = {
  margin: 0,
  color: "rgba(255,255,255,0.86)",
  lineHeight: 1.7,
  fontSize: "14px",
};