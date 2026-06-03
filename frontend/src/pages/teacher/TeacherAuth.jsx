import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStoredUser, getToken, isTokenExpired, publicFetch, saveAuth } from '../../api';
import PaymentInstructions from '../../components/PaymentInstructions';

export default function TeacherAuth({ mode = 'login' }) {
  const navigate = useNavigate();
  const isRegister = mode === 'register';
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    identifier: '',
    selectedPackage: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (token && user && !isTokenExpired(token)) {
      navigate(user.role === 'teacher_materials' ? '/teacher/dashboard' : user.role === 'admin' || user.isAdmin ? '/admin' : '/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    publicFetch('/teacher-materials/packages')
      .then((data) => setPackages(Array.isArray(data) ? data : []))
      .catch(() => setPackages([]));
  }, []);

  const title = useMemo(() => (isRegister ? 'Create Teacher Materials account' : 'Teacher Materials login'), [isRegister]);
  const subtitle = useMemo(
    () => isRegister
      ? 'Register for teaching notes, guides, CBC-aligned classroom resources, and downloadable materials.'
      : 'Use your registered phone number or email to access teaching materials.',
    [isRegister]
  );

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/teacher-materials/register' : '/teacher-materials/login';
      const body = isRegister
        ? {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim() || null,
            password: form.password,
            selectedPackage: form.selectedPackage.trim(),
          }
        : {
            identifier: form.identifier.trim(),
            password: form.password,
          };

      const data = await publicFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      saveAuth({ token: data.token, user: data.user });
      navigate('/teacher/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Teacher Materials access failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_24%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#155e75_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">Teacher Materials</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">ZedExam Pro</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
            Teaching notes, teacher guides, exam-style support resources, and downloadable classroom materials for teachers who only need content access.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ['Teacher notes', 'Structured around subject, grade, topic, objectives, and key concepts.'],
              ['Teacher guides', 'Includes suggested teaching methods and common learner difficulties.'],
              ['Assessment support', 'Exam-style questions with answers or marking guidance where available.'],
              ['Manual activation', 'Pay by mobile money, send proof on WhatsApp, then admin activates access.'],
            ].map(([heading, text]) => (
              <div key={heading} className="rounded-[24px] border border-white/10 bg-white/10 p-5">
                <h2 className="text-lg font-bold">{heading}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl shadow-slate-950/25 sm:p-8">
          <div className="flex flex-wrap gap-3">
            <Link className="btn btn-secondary" to="/login">Student Login</Link>
            <Link className={`btn ${isRegister ? 'btn-secondary' : 'btn-primary'}`} to="/teacher/login">Teacher Materials Login</Link>
            <Link className={`btn ${isRegister ? 'btn-primary' : 'btn-secondary'}`} to="/teacher/register">Teacher Register</Link>
            <Link className="btn btn-secondary" to="/admin/login">Admin Login</Link>
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">Access portal</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>

          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isRegister ? (
              <>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Full Name
                  <input className="input" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Teacher full name" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Registered Phone Number
                  <input className="input" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="e.g. 097xxxxxxx" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Email (optional)
                  <input className="input" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="teacher@example.com" />
                </label>
                {packages.length ? (
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">Selected Package
                    <select className="input" value={form.selectedPackage} onChange={(event) => updateField('selectedPackage', event.target.value)}>
                      <option value="">Select package</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.name}>{pkg.name} - K{Number(pkg.priceZmw || 0).toFixed(2)}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">Selected Package
                    <input className="input" value={form.selectedPackage} onChange={(event) => updateField('selectedPackage', event.target.value)} placeholder="e.g. Teacher Materials Monthly" />
                  </label>
                )}
              </>
            ) : (
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Phone Number or Email
                <input className="input" value={form.identifier} onChange={(event) => updateField('identifier', event.target.value)} placeholder="Use your registered phone number" />
              </label>
            )}

            <label className="grid gap-2 text-sm font-semibold text-slate-700">Password
              <input className="input" type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} placeholder={isRegister ? 'Create password' : 'Enter password'} />
            </label>

            <button className="btn btn-primary h-12 w-full" disabled={loading}>
              {loading ? 'Please wait...' : isRegister ? 'Create Teacher Materials Account' : 'Login to Teacher Materials'}
            </button>
          </form>

          {isRegister ? <div className="mt-6"><PaymentInstructions status="Pending" packageName={form.selectedPackage || 'Teacher Materials'} /></div> : null}
        </section>
      </div>
    </div>
  );
}
