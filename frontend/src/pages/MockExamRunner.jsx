import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { authFetch, clearAuth, getStoredUser } from "../api";

export default function MockExamRunner() {
  const { mockId } = useParams();
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);

  const [mockExam, setMockExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMockExam();
  }, [mockId]);

  useEffect(() => {
    if (!questions.length || !timeLeft || submitting) return;

    if (timeLeft <= 0) {
      handleSubmitMock();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, questions.length, submitting]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        alert("Do not leave the mock exam while it is in progress.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Your mock exam progress may be lost.";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const loadMockExam = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await authFetch(`/mock-exams/${mockId}`);
      const safeMock = data || null;

      const safeQuestions = Array.isArray(safeMock?.questions)
        ? safeMock.questions
        : [];

      if (!safeMock || !safeQuestions.length) {
        throw new Error("Mock exam not found or has no questions.");
      }

      setMockExam(safeMock);
      setQuestions(safeQuestions);
      setTimeLeft(Number(safeMock.duration || 30) * 60);
    } catch (err) {
      setError(err.message || "Failed to load mock exam.");
      setMockExam(null);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  const handleSelectOption = (questionId, optionValue) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionValue,
    }));
  };


  const handleSubmitMock = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const totalQuestions = questions.length;

      const payload = {
        mockExamId: Number(mockId),
        totalQuestions,
        answers,
      };

      const result = await authFetch("/results", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!result?.result?.id) {
        throw new Error("Result not returned correctly.");
      }

      navigate(`/results/${result.result.id}`, { replace: true });
    } catch (err) {
      setError(err.message || "Failed to submit mock exam.");
      setSubmitting(false);
    }
  };

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[currentIndex];
  const progressPercent = totalQuestions
    ? Math.round(((currentIndex + 1) / totalQuestions) * 100)
    : 0;

  const formattedOptions = useMemo(() => {
    if (!currentQuestion) return [];

    return [
      currentQuestion.optionA,
      currentQuestion.optionB,
      currentQuestion.optionC,
      currentQuestion.optionD,
    ]
      .filter(Boolean)
      .map((opt, i) => ({
        key: i,
        label: opt,
        value: opt,
        optionLetter: ["A", "B", "C", "D"][i],
      }));
  }, [currentQuestion]);

  const selectedValue = currentQuestion
    ? answers[currentQuestion.id]
    : undefined;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div style={pageShell}>
        <div style={statusCard}>
          <h2 style={statusTitle}>Loading mock exam...</h2>
          <p style={statusText}>
            Please wait while your mock paper is being prepared.
          </p>
        </div>
      </div>
    );
  }

  if (error && !currentQuestion) {
    return (
      <div style={pageShell}>
        <div style={statusCard}>
          <h2 style={statusTitle}>Mock exam unavailable</h2>
          <p style={statusText}>{error}</p>
          <div style={statusActions}>
            <button onClick={() => navigate(-1)} style={secondaryButton}>
              Go Back
            </button>
            <button onClick={loadMockExam} style={primaryButton}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div style={pageShell}>
        <div style={statusCard}>
          <h2 style={statusTitle}>No questions available</h2>
          <p style={statusText}>
            This mock exam does not contain any questions yet.
          </p>
          <div style={statusActions}>
            <button onClick={() => navigate("/mock-exams")} style={primaryButton}>
              Back to Mock Exams
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isLastQuestion = currentIndex === totalQuestions - 1;
  const firstName = user?.name ? user.name.split(" ")[0] : "Student";

  return (
    <div style={pageShell}>
      <div style={container}>
        <header style={headerCard}>
          <div style={headerTop}>
            <div>
              <div style={eyebrow}>Timed Mock Examination</div>
              <h1 style={pageTitle}>{mockExam?.title || "Mock Exam"}</h1>
              <p style={pageSubtitle}>
                Work carefully and complete all questions before the timer ends.
              </p>
            </div>

            <div style={headerActions}>
              <Link to="/dashboard" style={ghostLink}>
                Dashboard
              </Link>
              <Link to="/mock-exams" style={ghostLink}>
                Mock Exams
              </Link>
              <button type="button" onClick={handleLogout} style={logoutButton}>
                Logout
              </button>
            </div>
          </div>

          <div style={statsGrid}>
            <TopStat label="Candidate" value={firstName} />
            <TopStat label="Question" value={`${currentIndex + 1} of ${totalQuestions}`} />
            <TopStat label="Answered" value={`${answeredCount}/${totalQuestions}`} />
            <TopStat
              label="Time Left"
              value={formatTime(timeLeft)}
              danger={timeLeft <= 60}
            />
          </div>

          <div style={progressWrap}>
            <div style={progressBar}>
              <div
                style={{
                  ...progressFill,
                  width: `${progressPercent}%`,
                }}
              />
            </div>
          </div>
        </header>

        {error ? <div style={inlineError}>{error}</div> : null}

        <div style={mainGrid}>
          <aside style={sidebarCard}>
            <h3 style={sidebarTitle}>Question Navigator</h3>
            <p style={sidebarText}>
              Move between questions and monitor your progress.
            </p>

            <div style={questionGrid}>
              {questions.map((q, index) => {
                const answered = answers[q.id] !== undefined;
                const active = index === currentIndex;

                return (
                  <button
                    key={q.id || index}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    style={{
                      ...navQuestionButton,
                      ...(answered ? answeredQuestionButton : {}),
                      ...(active ? activeQuestionButton : {}),
                    }}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div style={legendWrap}>
              <div style={legendItem}>
                <span style={{ ...legendDot, background: "#1d4ed8" }} />
                Current
              </div>
              <div style={legendItem}>
                <span style={{ ...legendDot, background: "#16a34a" }} />
                Answered
              </div>
              <div style={legendItem}>
                <span style={{ ...legendDot, background: "#334155" }} />
                Unanswered
              </div>
            </div>
          </aside>

          <section style={questionCard}>
            <div style={questionMetaRow}>
              <div style={questionBadge}>
                Question {currentIndex + 1}
              </div>
              <div style={topicBadge}>
                Duration: {mockExam?.duration || 30} mins
              </div>
            </div>

            <h2 style={questionText}>
              {currentQuestion.question || "Question text unavailable."}
            </h2>

            <div style={optionsWrap}>
              {formattedOptions.map((opt) => {
                const selected = selectedValue === opt.value;

                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      handleSelectOption(currentQuestion.id, opt.value)
                    }
                    style={{
                      ...optionButton,
                      ...(selected ? selectedOptionButton : {}),
                    }}
                  >
                    <div
                      style={{
                        ...optionLetter,
                        ...(selected ? selectedOptionLetter : {}),
                      }}
                    >
                      {opt.optionLetter}
                    </div>

                    <div style={optionLabel}>{opt.label}</div>
                  </button>
                );
              })}
            </div>

            <div style={bottomBar}>
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                disabled={currentIndex === 0}
                style={{
                  ...secondaryButton,
                  opacity: currentIndex === 0 ? 0.5 : 1,
                  cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                }}
              >
                Previous
              </button>

              <div style={bottomCenterText}>
                {answeredCount === totalQuestions
                  ? "All questions answered"
                  : `${totalQuestions - answeredCount} unanswered question${
                      totalQuestions - answeredCount === 1 ? "" : "s"
                    } left`}
              </div>

              {!isLastQuestion ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  style={primaryButton}
                >
                  Next Question
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitMock}
                  disabled={submitting}
                  style={{
                    ...submitButton,
                    opacity: submitting ? 0.75 : 1,
                    cursor: submitting ? "wait" : "pointer",
                  }}
                >
                  {submitting ? "Submitting..." : "Submit Mock"}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TopStat({ label, value, danger = false }) {
  return (
    <div
      style={{
        ...topStatCard,
        ...(danger
          ? {
              background: "rgba(127, 29, 29, 0.9)",
              border: "1px solid rgba(248,113,113,0.35)",
            }
          : {}),
      }}
    >
      <div style={topStatLabel}>{label}</div>
      <div style={topStatValue}>{value}</div>
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
  maxWidth: "1250px",
  margin: "0 auto",
};

const headerCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "28px",
  padding: "26px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  marginBottom: "22px",
};

const headerTop = {
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

const pageTitle = {
  margin: 0,
  fontSize: "34px",
  color: "#ffffff",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

const pageSubtitle = {
  margin: "10px 0 0",
  color: "rgba(255,255,255,0.75)",
  fontSize: "15px",
  lineHeight: 1.7,
};

const headerActions = {
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

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginTop: "24px",
};

const topStatCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "18px",
  padding: "16px",
};

const topStatLabel = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.68)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: "700",
  marginBottom: "8px",
};

const topStatValue = {
  fontSize: "24px",
  color: "#ffffff",
  fontWeight: "800",
};

const progressWrap = {
  marginTop: "20px",
};

const progressBar = {
  width: "100%",
  height: "12px",
  background: "rgba(255,255,255,0.08)",
  borderRadius: "999px",
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
};

const inlineError = {
  marginBottom: "18px",
  background: "rgba(127, 29, 29, 0.9)",
  color: "#ffffff",
  padding: "14px 16px",
  borderRadius: "16px",
  border: "1px solid rgba(248,113,113,0.3)",
  fontWeight: "600",
};

const mainGrid = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: "22px",
};

const sidebarCard = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "26px",
  padding: "22px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

const sidebarTitle = {
  margin: 0,
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: "800",
};

const sidebarText = {
  margin: "10px 0 18px",
  color: "rgba(255,255,255,0.72)",
  fontSize: "14px",
  lineHeight: 1.6,
};

const questionGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "10px",
};

const navQuestionButton = {
  height: "48px",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#334155",
  color: "#ffffff",
  fontWeight: "800",
  cursor: "pointer",
};

const activeQuestionButton = {
  background: "#1d4ed8",
  border: "1px solid rgba(147,197,253,0.5)",
  boxShadow: "0 10px 24px rgba(29,78,216,0.35)",
};

const answeredQuestionButton = {
  background: "#16a34a",
};

const legendWrap = {
  marginTop: "18px",
  display: "grid",
  gap: "10px",
};

const legendItem = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "rgba(255,255,255,0.8)",
  fontSize: "14px",
};

const legendDot = {
  width: "12px",
  height: "12px",
  borderRadius: "999px",
  display: "inline-block",
};

const questionCard = {
  background: "#ffffff",
  borderRadius: "28px",
  padding: "28px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
};

const questionMetaRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: "18px",
};

const questionBadge = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 14px",
  borderRadius: "999px",
  background: "#dbeafe",
  color: "#1d4ed8",
  fontWeight: "800",
  fontSize: "13px",
};

const topicBadge = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 14px",
  borderRadius: "999px",
  background: "#f1f5f9",
  color: "#334155",
  fontWeight: "700",
  fontSize: "13px",
};

const questionText = {
  margin: "0 0 24px",
  fontSize: "28px",
  lineHeight: 1.45,
  color: "#0f172a",
  fontWeight: "800",
};

const optionsWrap = {
  display: "grid",
  gap: "14px",
};

const optionButton = {
  width: "100%",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  borderRadius: "18px",
  padding: "16px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const selectedOptionButton = {
  background: "#eff6ff",
  border: "2px solid #2563eb",
  boxShadow: "0 10px 24px rgba(37,99,235,0.12)",
};

const optionLetter = {
  minWidth: "44px",
  width: "44px",
  height: "44px",
  borderRadius: "14px",
  background: "#e2e8f0",
  color: "#0f172a",
  display: "grid",
  placeItems: "center",
  fontWeight: "800",
  fontSize: "15px",
};

const selectedOptionLetter = {
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#ffffff",
};

const optionLabel = {
  fontSize: "16px",
  lineHeight: 1.6,
  color: "#0f172a",
  fontWeight: "600",
};

const bottomBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
  marginTop: "28px",
  paddingTop: "20px",
  borderTop: "1px solid #e2e8f0",
};

const bottomCenterText = {
  color: "#64748b",
  fontSize: "14px",
  fontWeight: "600",
  lineHeight: 1.6,
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

const submitButton = {
  padding: "13px 20px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #16a34a, #15803d)",
  color: "#ffffff",
  fontWeight: "800",
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(22,163,74,0.24)",
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

const statusCard = {
  maxWidth: "560px",
  margin: "80px auto",
  background: "#ffffff",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
  textAlign: "center",
};

const statusTitle = {
  margin: "0 0 10px",
  fontSize: "28px",
  color: "#0f172a",
};

const statusText = {
  margin: 0,
  color: "#64748b",
  lineHeight: 1.7,
  fontSize: "15px",
};

const statusActions = {
  marginTop: "22px",
  display: "flex",
  justifyContent: "center",
  gap: "12px",
  flexWrap: "wrap",
};