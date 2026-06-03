import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authFetch, clearAuth, getStoredUser } from "../../api";

export default function BulkUpload() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);

  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);

  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [bulkText, setBulkText] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsedPreview, setParsedPreview] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (subjectId) {
      fetchTopicsBySubject(subjectId);
    } else {
      setTopics([]);
      setTopicId("");
    }
  }, [subjectId]);

  useEffect(() => {
    const parsed = parseBulkQuestions(bulkText);
    setParsedPreview(parsed);
  }, [bulkText]);

  const loadSubjects = async () => {
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

  const fetchTopicsBySubject = async (selectedSubjectId) => {
    setLoadingTopics(true);
    setError("");

    try {
      let data;

      try {
        data = await authFetch(`/subjects/${selectedSubjectId}/topics`);
      } catch {
        data = await authFetch("/topics");
        data = Array.isArray(data)
          ? data.filter(
              (topic) =>
                String(topic.subjectId || topic.subject?.id || "") ===
                String(selectedSubjectId)
            )
          : [];
      }

      setTopics(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load topics.");
      setTopics([]);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  const handleUpload = async () => {
    setError("");
    setSuccess("");

    if (!topicId) {
      setError("Please select a topic.");
      return;
    }

    if (!bulkText.trim()) {
      setError("Please paste your questions first.");
      return;
    }

    const parsed = parseBulkQuestions(bulkText);

    if (!parsed.length) {
      setError("No valid questions were found in the pasted content.");
      return;
    }

    setUploading(true);

    try {
      let uploadedCount = 0;

      for (const item of parsed) {
        const payload = {
          topicId: Number(topicId),
          question: item.question,
          optionA: item.optionA,
          optionB: item.optionB,
          optionC: item.optionC,
          optionD: item.optionD,
          correctAnswer: item.correctAnswer,
          explanation: item.explanation || "",
          image: item.image || "",
        };

        await authFetch("/questions", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        uploadedCount += 1;
      }

      setSuccess(`${uploadedCount} questions uploaded successfully.`);
      setBulkText("");
      setParsedPreview([]);
    } catch (err) {
      setError(err.message || "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSample = () => {
    setBulkText(`QUESTION: What is the main function of a CPU?
A: To display images
B: To process instructions
C: To print documents
D: To store paper
ANSWER: To process instructions
EXPLANATION: The CPU executes and processes instructions in a computer system.

QUESTION: Which of the following is an input device?
A: Monitor
B: Printer
C: Mouse
D: Speaker
ANSWER: Mouse
EXPLANATION: A mouse is used to enter data and commands into a computer.`);
  };

  const selectedSubjectName =
    subjects.find((subject) => String(subject.id) === String(subjectId))?.name || "";
  const selectedTopicName =
    topics.find((topic) => String(topic.id) === String(topicId))?.title ||
    topics.find((topic) => String(topic.id) === String(topicId))?.name ||
    "";
  const adminName = user?.name || "Admin";

  return (
    <div style={pageShell}>
      <div style={container}>
        <header style={heroCard}>
          <div style={heroTop}>
            <div>
              <div style={eyebrow}>Admin Module</div>
              <h1 style={heroTitle}>Bulk Upload Questions</h1>
              <p style={heroSubtitle}>
                Welcome, {adminName}. Paste multiple questions at once, preview them,
                and upload them quickly into the correct topic.
              </p>
            </div>

            <div style={heroActions}>
              <Link to="/admin" style={ghostLink}>
                Dashboard
              </Link>
              <Link to="/admin/questions" style={ghostLink}>
                Questions
              </Link>
              <button onClick={handleLogout} style={logoutButton}>
                Logout
              </button>
            </div>
          </div>

          <div style={heroStats}>
            <HeroStat title="Subjects" value={loading ? "..." : subjects.length} />
            <HeroStat title="Topics" value={loadingTopics ? "..." : topics.length} />
            <HeroStat title="Parsed" value={parsedPreview.length} />
            <HeroStat title="Status" value={uploading ? "Uploading..." : "Ready"} />
          </div>
        </header>

        {error ? <Alert type="error" message={error} /> : null}
        {success ? <Alert type="success" message={success} /> : null}

        <div style={mainGrid}>
          <div style={{ display: "grid", gap: "20px" }}>
            <section style={panelCard}>
              <div style={sectionHeader}>
                <div>
                  <h2 style={sectionTitle}>Step 1: Select Target Topic</h2>
                  <p style={sectionSubtitle}>
                    Choose the subject and topic where these questions should be saved.
                  </p>
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <label style={label}>Subject</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    style={input}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={label}>Topic</label>
                  <select
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    style={input}
                    disabled={!subjectId || loadingTopics}
                  >
                    <option value="">
                      {loadingTopics
                        ? "Loading topics..."
                        : subjectId
                        ? "Select Topic"
                        : "Select subject first"}
                    </option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title || topic.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(selectedSubjectName || selectedTopicName) && (
                <div style={destinationCard}>
                  <div style={destinationLabel}>Upload Destination</div>
                  <div style={destinationValue}>
                    {selectedSubjectName || "-"} / {selectedTopicName || "-"}
                  </div>
                </div>
              )}
            </section>

            <section style={panelCard}>
              <div style={sectionHeaderRow}>
                <div>
                  <h2 style={sectionTitle}>Step 2: Paste Questions</h2>
                  <p style={sectionSubtitle}>
                    Paste your content using the required structure below.
                  </p>
                </div>

                <button type="button" onClick={handleLoadSample} style={secondaryButton}>
                  Load Sample Format
                </button>
              </div>

              <div style={hintBox}>
                <div style={hintTitle}>Required Format</div>
                <pre style={hintCode}>
{`QUESTION: What is 2 + 2?
A: 3
B: 4
C: 5
D: 6
ANSWER: 4
EXPLANATION: 2 + 2 equals 4.

QUESTION: Another question here...
A: Option A
B: Option B
C: Option C
D: Option D
ANSWER: Option B`}
                </pre>
              </div>

              <div style={{ marginTop: "16px" }}>
                <label style={label}>Bulk Question Text</label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Paste your bulk questions here..."
                  style={bulkTextarea}
                />
              </div>

              <div style={buttonRow}>
                <button
                  type="button"
                  onClick={handleUpload}
                  style={primaryButton}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Questions"}
                </button>

                <button
                  type="button"
                  onClick={() => setBulkText("")}
                  style={secondaryButton}
                  disabled={uploading}
                >
                  Clear
                </button>
              </div>
            </section>
          </div>

          <section style={panelCard}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Step 3: Preview Parsed Questions</h2>
                <p style={sectionSubtitle}>
                  Review what the system detected before uploading.
                </p>
              </div>
            </div>

            {loading ? (
              <div style={emptyState}>Loading...</div>
            ) : parsedPreview.length === 0 ? (
              <div style={emptyState}>
                No questions parsed yet. Paste content above to preview it.
              </div>
            ) : (
              <div style={previewList}>
                {parsedPreview.map((item, index) => (
                  <div key={index} style={questionCard}>
                    <div style={questionMetaRow}>
                      <span style={tagBlue}>Question {index + 1}</span>
                    </div>

                    <h3 style={questionTitle}>{item.question}</h3>

                    <div style={optionsBox}>
                      <OptionLine label="A" value={item.optionA} />
                      <OptionLine label="B" value={item.optionB} />
                      <OptionLine label="C" value={item.optionC} />
                      <OptionLine label="D" value={item.optionD} />
                    </div>

                    <div style={answerBox}>
                      <span style={answerLabel}>Correct Answer:</span>
                      <span style={answerValue}>{item.correctAnswer}</span>
                    </div>

                    {item.explanation ? (
                      <div style={infoBlock}>
                        <div style={infoLabel}>Explanation</div>
                        <div style={infoText}>{item.explanation}</div>
                      </div>
                    ) : null}

                    {item.image ? (
                      <div style={infoBlock}>
                        <div style={infoLabel}>Image</div>
                        <div style={imageLinkText}>{item.image}</div>
                      </div>
                    ) : null}
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

function parseBulkQuestions(text) {
  if (!text.trim()) return [];

  const normalizedText = text.replace(/\r?\n/g, "\n").trim();

  const rawBlocks = normalizedText
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  const parsed = [];

  for (const block of rawBlocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) continue;

    let question = "";
    let optionA = "";
    let optionB = "";
    let optionC = "";
    let optionD = "";
    let correctAnswer = "";
    let explanation = "";
    let image = "";

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (/^QUESTION\s*:/i.test(line)) {
        question = line.replace(/^QUESTION\s*:\s*/i, "").trim();
      } else if (/^A[.:]/i.test(line)) {
        optionA = line.replace(/^A[.:]\s*/i, "").trim();
      } else if (/^B[.:]/i.test(line)) {
        optionB = line.replace(/^B[.:]\s*/i, "").trim();
      } else if (/^C[.:]/i.test(line)) {
        optionC = line.replace(/^C[.:]\s*/i, "").trim();
      } else if (/^D[.:]/i.test(line)) {
        optionD = line.replace(/^D[.:]\s*/i, "").trim();
      } else if (/^ANSWER\s*:/i.test(line)) {
        correctAnswer = line.replace(/^ANSWER\s*:\s*/i, "").trim().toUpperCase();
      } else if (/^EXPLANATION\s*:/i.test(line)) {
        explanation = line.replace(/^EXPLANATION\s*:\s*/i, "").trim();
      } else if (/^IMAGE\s*:/i.test(line)) {
        image = line.replace(/^IMAGE\s*:\s*/i, "").trim();
      } else if (!question) {
        question = line;
      }
    }

    if (!["A", "B", "C", "D"].includes(correctAnswer)) {
      const answerMap = {
        [optionA.toLowerCase()]: "A",
        [optionB.toLowerCase()]: "B",
        [optionC.toLowerCase()]: "C",
        [optionD.toLowerCase()]: "D",
      };
      correctAnswer = answerMap[correctAnswer.toLowerCase()] || "";
    }

    if (question && optionA && optionB && optionC && optionD && correctAnswer) {
      parsed.push({
        question,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer,
        explanation,
        image,
      });
    }
  }

  return parsed;
}

function HeroStat({ title, value }) {
  return (
    <div style={heroStatCard}>
      <div style={heroStatTitle}>{title}</div>
      <div style={heroStatValue}>{value}</div>
    </div>
  );
}

function OptionLine({ label, value }) {
  return (
    <div style={optionRow}>
      <span style={optionLabel}>{label}.</span>
      <span style={optionValue}>{value || "-"}</span>
    </div>
  );
}

function Alert({ type, message }) {
  return (
    <div
      style={{
        ...alertBase,
        background:
          type === "error"
            ? "rgba(127, 29, 29, 0.92)"
            : "rgba(22, 101, 52, 0.92)",
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
  maxWidth: "1320px",
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
  gridTemplateColumns: "1fr 1fr",
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

const sectionHeaderRow = {
  marginBottom: "18px",
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  flexWrap: "wrap",
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

const grid2 = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
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

const destinationCard = {
  marginTop: "16px",
  padding: "14px 16px",
  borderRadius: "16px",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
};

const destinationLabel = {
  fontSize: "12px",
  fontWeight: "800",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#64748b",
  marginBottom: "6px",
};

const destinationValue = {
  color: "#1d4ed8",
  fontSize: "16px",
  fontWeight: "800",
};

const hintBox = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "16px",
};

const hintTitle = {
  color: "#0f172a",
  fontWeight: "800",
  marginBottom: "8px",
};

const hintCode = {
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily: "Consolas, monospace",
  fontSize: "13px",
  lineHeight: 1.6,
  color: "#334155",
};

const bulkTextarea = {
  ...input,
  minHeight: "320px",
  fontFamily: "Consolas, monospace",
  lineHeight: 1.6,
  resize: "vertical",
};

const buttonRow = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
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

const previewList = {
  display: "grid",
  gap: "14px",
};

const questionCard = {
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  padding: "18px",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
};

const questionMetaRow = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: "10px",
};

const tagBlue = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "999px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: "12px",
  fontWeight: "800",
};

const questionTitle = {
  margin: "0 0 12px",
  color: "#0f172a",
  fontSize: "18px",
  lineHeight: 1.7,
  fontWeight: "800",
};

const optionsBox = {
  display: "grid",
  gap: "8px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "14px",
  marginBottom: "12px",
};

const optionRow = {
  fontSize: "14px",
  color: "#334155",
  lineHeight: 1.6,
  display: "flex",
  gap: "8px",
  alignItems: "flex-start",
};

const optionLabel = {
  fontWeight: "800",
  minWidth: "20px",
  color: "#0f172a",
};

const optionValue = {
  color: "#334155",
};

const answerBox = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  borderRadius: "999px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: "13px",
  fontWeight: "800",
  marginBottom: "12px",
  flexWrap: "wrap",
};

const answerLabel = {
  opacity: 0.9,
};

const answerValue = {
  color: "#166534",
};

const infoBlock = {
  marginTop: "10px",
  padding: "12px 14px",
  borderRadius: "14px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const infoLabel = {
  fontSize: "12px",
  fontWeight: "800",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#64748b",
  marginBottom: "6px",
};

const infoText = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.7,
};

const imageLinkText = {
  color: "#2563eb",
  fontSize: "14px",
  lineHeight: 1.6,
  wordBreak: "break-word",
};