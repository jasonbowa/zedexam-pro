import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminLogin, getStoredUser, saveAuth } from "../api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;

    const isAdmin = user.role === "admin" || user.isAdmin === true;
    navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = await adminLogin({ email, password });
      const saved = saveAuth(payload);
      const user = saved?.user || payload?.user || null;
      const isAdmin = user?.role === "admin" || user?.isAdmin === true;

      if (!saved?.token || !user || !isAdmin) {
        throw new Error("Admin account not recognized. Check the admin credentials and backend response.");
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8 shadow-2xl shadow-cyan-950/20">
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-300" />
              Secure admin portal
            </div>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Manage ZedExam Pro with full administrative control
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Use this portal to manage subjects, topics, questions, mock exams, students,
              subscriptions, schools, and teachers from one place.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["Content control", "Create and organize curriculum content quickly."],
                ["Student management", "Activate, deactivate, edit, and support learners."],
                ["Exam operations", "Build mocks, upload questions, and monitor usage."],
                ["Growth ready", "Designed to support launch, feedback, and scaling."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link to="/" className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/10">
                Back to landing page
              </Link>
              <Link to="/register" className="rounded-2xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-cyan-300">
                Student registration
              </Link>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Admin Login
              </p>
              <h2 className="mt-2 text-3xl font-bold">Access admin dashboard</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Sign in with the administrator email and password configured for the backend.
              </p>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@zedexam.com"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3.5 text-base font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Login as Admin"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
