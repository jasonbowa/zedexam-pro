import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getStoredUser, saveAuth, studentLogin } from "../api";

const onboardingSteps = [
  {
    number: "01",
    title: "Create your account",
    text: "Tap Student Register, enter your full name, phone number, grade, and password.",
  },
  {
    number: "02",
    title: "Choose your level",
    text: "Select the correct class level so the platform shows the right subjects and materials.",
  },
  {
    number: "03",
    title: "Start practicing",
    text: "Open a subject, answer questions, and build confidence with exam-style practice.",
  },
  {
    number: "04",
    title: "Track performance",
    text: "See your scores, monitor weak areas, and improve topic by topic.",
  },
];

const featureHighlights = [
  "ECZ-style exam practice",
  "Mobile-friendly learning",
  "Instant score tracking",
  "Designed for Zambian learners",
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [phoneNumber, setPhoneNumber] = useState(location.state?.phoneNumber || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getStoredUser();

    if (user?.role === "admin") {
      navigate("/admin");
      return;
    }

    if (user?.role === "student") {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await studentLogin({ phoneNumber, password });

      if (!data?.user) {
        throw new Error("Invalid login response.");
      }

      if (data.user.role && data.user.role !== "student") {
        throw new Error("This page is for students. Use Admin Login for admin access.");
      }

      saveAuth(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-40 right-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500 font-bold text-slate-950 shadow-lg shadow-cyan-500/30">
                Z
              </div>
              <div>
                <p className="text-lg font-semibold tracking-wide">ZedExam Pro</p>
                <p className="text-xs text-slate-300">Smart exam practice for serious students</p>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/register"
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400 hover:bg-white/10"
            >
              Student Register
            </Link>
            <Link
              to="/admin-login"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10">
          <section className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-300" />
              Now open for student practice and performance tracking
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                Study smarter, practice faster, and prepare with confidence using{" "}
                <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                  ZedExam Pro
                </span>
              </h1>

              <p className="max-w-3xl text-lg leading-8 text-slate-300">
                ZedExam Pro helps students practice exam-style questions, strengthen weak topics,
                and build confidence before tests. It is built for mobile-first learning and made
                to support serious academic improvement.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/20 to-sky-500/10 p-6 shadow-2xl shadow-cyan-900/20">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  Featured Promotion
                </p>
                <h2 className="text-2xl font-bold text-white">
                  Turn revision time into real exam confidence
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-200">
                  Practice topics, monitor your scores, and improve where it matters most. Whether
                  you are preparing for school tests or major examinations, ZedExam Pro gives you a
                  cleaner and smarter way to revise.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to="/register"
                    className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Create Student Account
                  </Link>
                  <a
                    href="#how-it-works"
                    className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    See How It Works
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Why students join
                </p>

                <div className="mt-4 grid gap-3">
                  {featureHighlights.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-300">
                        ✓
                      </div>
                      <span className="text-sm text-slate-100">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-4">
                    <p className="text-2xl font-bold text-white">24/7</p>
                    <p className="mt-1 text-xs text-slate-400">Access</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-4">
                    <p className="text-2xl font-bold text-white">Fast</p>
                    <p className="mt-1 text-xs text-slate-400">Practice</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-4">
                    <p className="text-2xl font-bold text-white">Clear</p>
                    <p className="mt-1 text-xs text-slate-400">Progress</p>
                  </div>
                </div>
              </div>
            </div>

            <section id="how-it-works" className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
              <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  How to create your account
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  Simple steps to get started
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                  The registration process is quick. Students can create an account in a minute and
                  begin practicing immediately.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {onboardingSteps.map((step) => (
                  <div
                    key={step.number}
                    className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 transition hover:border-cyan-400/30 hover:bg-slate-900"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-lg font-bold text-cyan-300">
                      {step.number}
                    </div>
                    <h4 className="text-lg font-semibold text-white">{step.title}</h4>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{step.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-sm leading-7 text-cyan-100">
                Tip: after registration, students should use the same phone number and password to
                log in next time.
              </div>
            </section>
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[28px] border border-white/10 bg-white/8 p-6 shadow-2xl backdrop-blur-xl">
              <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  Student Login
                </p>
                <h2 className="mt-2 text-3xl font-bold text-white">Access your portal</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Sign in with your phone number and continue learning where you left off.
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {location.state?.registered ? (
                <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  Account created successfully. You can now log in with your phone number and password.
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Use the registered phone number"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-cyan-400 px-4 py-3.5 text-base font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Signing in..." : "Login to Student Portal"}
                </button>
              </form>

              <div className="mt-6 space-y-3">
                <Link
                  to="/register"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 transition hover:border-cyan-400/30 hover:bg-slate-900"
                >
                  <div>
                    <p className="font-semibold text-white">New student?</p>
                    <p className="text-sm text-slate-400">Create an account and start learning</p>
                  </div>
                  <span className="text-cyan-300">→</span>
                </Link>

                <Link
                  to="/admin-login"
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 transition hover:border-white/20 hover:bg-slate-900"
                >
                  <div>
                    <p className="font-semibold text-white">Admin access</p>
                    <p className="text-sm text-slate-400">For content and platform management</p>
                  </div>
                  <span className="text-slate-300">→</span>
                </Link>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Quick account creation checklist
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>• Full name</li>
                  <li>• Active phone number</li>
                  <li>• Correct grade selection</li>
                  <li>• Strong password</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}