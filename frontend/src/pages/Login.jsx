import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { publicFetch, saveAuth, getToken, getStoredUser, isTokenExpired } from '../api';
import PaymentInstructions from '../components/PaymentInstructions';

const gradeOptions = [
  { value: 'FORM 1', label: 'FORM 1' },
  { value: 'FORM 2', label: 'FORM 2' },
  { value: 'FORM 3', label: 'FORM 3' },
  { value: 'FORM 4', label: 'FORM 4' },
  { value: 'GRADE 10', label: 'GRADE 10' },
  { value: 'GRADE 11', label: 'GRADE 11' },
  { value: 'GRADE 12', label: 'GRADE 12' },
];

const normalizeGrade = (grade) => String(grade || '').replace(/_/g, ' ').trim();

export default function Login({ initialMode = 'student-login' }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    grade: 'FORM 1',
    packageId: '',
    email: '',
    password: '',
  });
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (token && user && !isTokenExpired(token)) {
      navigate(user.role === 'admin' || user.isAdmin ? '/admin' : '/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const loadPackages = async () => {
      try {
        const data = await publicFetch('/subscriptions/public-packages');
        const activePackages = Array.isArray(data) ? data : [];
        setPackages(activePackages);
        if (activePackages.length) {
          setForm((prev) => (prev.packageId ? prev : { ...prev, packageId: String(activePackages[0].id) }));
        }
      } catch {
        setPackages([]);
      }
    };
    loadPackages();
  }, []);

  const title = useMemo(() => {
    if (mode === 'student-register') return 'Create student account';
    if (mode === 'admin-login') return 'Administrator access';
    return 'Student login';
  }, [mode]);

  const subtitle = useMemo(() => {
    if (mode === 'student-register') return 'Register a learner profile, then send proof so admin can activate your account manually.';
    if (mode === 'admin-login') return 'Use secure admin credentials to manage subjects, topics, and question banks.';
    return 'Sign in with your phone number and continue learning where you left off.';
  }, [mode]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectedPackage = useMemo(
    () => packages.find((pkg) => String(pkg.id) === String(form.packageId)),
    [packages, form.packageId]
  );

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const routeAfterAuth = (user) => (user?.role === 'admin' || user?.isAdmin ? '/admin' : '/dashboard');

  const handleStudentRegister = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!form.name.trim() || !form.phone.trim() || !form.password.trim() || !form.grade || !form.packageId) {
      setError('Name, phone, grade, package, and password are required.');
      return;
    }

    setLoading(true);
    try {
      const data = await publicFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          password: form.password,
          grade: normalizeGrade(form.grade),
          packageId: Number(form.packageId),
        }),
      });

      const reference = data.activationReference || data.subscription?.paymentReference || form.phone.trim();
      setSuccess(`Student account created. Use payment reference ${reference}, then wait for admin activation before logging in.`);
      setForm((prev) => ({ ...prev, name: '', phone: '', password: '' }));
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!form.phone.trim() || !form.password.trim()) {
      setError('Phone number and password are required.');
      return;
    }

    setLoading(true);
    try {
      const data = await publicFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: form.phone.trim(), password: form.password }),
      });
      saveAuth({ token: data.token, user: data.user });
      navigate(routeAfterAuth(data.user), { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid phone number or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!form.email.trim() || !form.password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const data = await publicFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      saveAuth({ token: data.token, user: data.user });
      navigate(routeAfterAuth(data.user), { replace: true });
    } catch (err) {
      setError(err.message || 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_20%),linear-gradient(135deg,#020617_0%,#0f172a_42%,#1e3a8a_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="rounded-[34px] border border-white/10 bg-white/6 p-7 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-blue-200">Launch-ready interface</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">ZedExam Pro</h1>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.24em] text-emerald-200">
            Powered by Classic Institute of Technology ZM
          </p>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
            A cleaner student experience for exam-style revision, topic practice, mock exams, analytics, and certificates.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ['Smart Revision', 'Organized by subject and topic for faster study flow.'],
              ['Mock Exam Mode', 'Timed practice that feels closer to real exam conditions.'],
              ['Result Tracking', 'Students can see progress and improve weak areas.'],
              ['Admin Control', 'Manage content, students, and question banks from one dashboard.'],
            ].map(([heading, text]) => (
              <div key={heading} className="rounded-[24px] border border-white/10 bg-white/8 p-5">
                <h2 className="text-lg font-bold">{heading}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-200">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[34px] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/25 sm:p-8">
          <div className="flex flex-wrap gap-3">
            <button className={`btn ${mode === 'student-login' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('student-login')}>Student Login</button>
            <button className={`btn ${mode === 'student-register' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('student-register')}>Student Register</button>
            <Link className="btn btn-secondary" to="/teacher/login">Teacher Materials Login</Link>
            <button className={`btn ${mode === 'admin-login' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('admin-login')}>Admin Login</button>
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-600">Access portal</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>

          {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}
          {success ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div> : null}

          {mode === 'student-register' ? (
            <>
              <form className="mt-6 space-y-4" onSubmit={handleStudentRegister}>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                  <input className="input h-12" value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Enter student name" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Phone Number</label>
                  <input className="input h-12" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="e.g. 097xxxxxxx" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Grade</label>
                  <select className="input h-12" value={form.grade} onChange={(e) => updateField('grade', e.target.value)}>
                    {gradeOptions.map((grade) => <option key={grade.value} value={grade.value}>{grade.label}</option>)}
                </select>
              </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Student Package</label>
                  <select className="input h-12" value={form.packageId} onChange={(e) => updateField('packageId', e.target.value)}>
                    <option value="">Select package</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>{pkg.name} • K{Number(pkg.priceZmw || 0).toFixed(2)} • {pkg.durationDays} days</option>
                    ))}
                  </select>
                  {packages.length === 0 ? (
                    <p className="mt-2 text-xs font-semibold text-amber-700">No active packages are published yet. Admin can add packages from Package Management.</p>
                  ) : null}
                </div>
                {selectedPackage ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                    <p className="font-black text-slate-950">{selectedPackage.name}</p>
                    <p className="mt-1">K{Number(selectedPackage.priceZmw || 0).toFixed(2)} / {selectedPackage.durationDays} days</p>
                    <p className="mt-2 leading-6">{selectedPackage.description || 'Student package with access controlled by admin after payment confirmation.'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-blue-100">Subjects: {selectedPackage.maxSubjects ?? 'All configured'}</span>
                      <span className="rounded-xl bg-white px-3 py-2 ring-1 ring-blue-100">Mock exams: {selectedPackage.maxMockExams ?? 'All configured'}</span>
                    </div>
                  </div>
                ) : null}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                <input type="password" className="input h-12" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Create password" />
                </div>
                <button className="btn btn-primary h-12 w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create Student Account'}</button>
              </form>

              <div className="mt-6">
                <PaymentInstructions status="Pending" packageName={selectedPackage?.name || 'Student Package'} />
              </div>
            </>
          ) : null}

          {mode === 'student-login' ? (
            <form className="mt-6 space-y-4" onSubmit={handleStudentLogin}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Phone Number</label>
                <input className="input h-12" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Use the registered phone number" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                <input type="password" className="input h-12" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Enter password" />
              </div>
              <button className="btn btn-primary h-12 w-full" disabled={loading}>{loading ? 'Signing in...' : 'Login to Student Portal'}</button>
            </form>
          ) : null}

          {mode === 'admin-login' ? (
            <form className="mt-6 space-y-4" onSubmit={handleAdminLogin}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Admin Email</label>
                <input type="email" className="input h-12" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="admin@zedexam.com" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                <input type="password" className="input h-12" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Enter password" />
              </div>
              <button className="btn btn-primary h-12 w-full" disabled={loading}>{loading ? 'Opening admin...' : 'Login to Admin Dashboard'}</button>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
