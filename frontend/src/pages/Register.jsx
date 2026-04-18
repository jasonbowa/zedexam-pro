import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredUser, saveAuth, studentRegister } from "../api";

const gradeOptions = [
  { value: "FORM_1", label: "FORM 1" },
  { value: "FORM_2", label: "FORM 2" },
  { value: "FORM_3", label: "FORM 3" },
  { value: "FORM_4", label: "FORM 4" },
  { value: "GRADE_10", label: "GRADE 10" },
  { value: "GRADE_11", label: "GRADE 11" },
  { value: "GRADE_12", label: "GRADE 12" },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    grade: "FORM_1",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;

    const isAdmin = user.role === "admin" || user.isAdmin === true;
    navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
  }, [navigate]);

  const updateField = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = await studentRegister(form);

      if (payload?.token && payload?.user) {
        saveAuth(payload);
        navigate("/dashboard", { replace: true });
        return;
      }

      navigate("/login", {
        replace: true,
        state: {
          registered: true,
          phoneNumber: form.phoneNumber,
        },
      });
    } catch (err) {
      setError(err.message || "Student registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8 shadow-2xl shadow-cyan-950/20">
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-300" />
              Create your learner account
            </div>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Get started on ZedExam Pro in a few simple steps
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Register once, then keep using your phone number and password to continue practice,
              track results, and grow your exam confidence.
            </p>

            <div className="mt-8 space-y-4">
              {[
                "Enter your full name clearly.",
                "Use an active phone number you can remember.",
                "Choose the correct class level for accurate content.",
                "Create a password you can keep safe.",
              ].map((item, index) => (
                <div key={item} className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15 font-bold text-cyan-300">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <Link to="/" className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/10">
                Back to landing page
              </Link>
              <Link to="/admin-login" className="rounded-2xl bg-white px-4 py-3 font-bold text-slate-950 transition hover:bg-slate-100">
                Admin Login
              </Link>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Student Register
              </p>
              <h2 className="mt-2 text-3xl font-bold">Create student account</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Register a learner profile and start practice immediately.
              </p>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={updateField("name")}
                  placeholder="Enter full name"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Phone Number</label>
                <input
                  type="text"
                  value={form.phoneNumber}
                  onChange={updateField("phoneNumber")}
                  placeholder="e.g. 0977000000"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Grade</label>
                <select
                  value={form.grade}
                  onChange={updateField("grade")}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  required
                >
                  {gradeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={updateField("password")}
                  placeholder="Create password"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3.5 text-base font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Creating account..." : "Create Student Account"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
