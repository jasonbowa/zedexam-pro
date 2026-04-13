import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearStoredUsers, getStoredUser, isAdminUser } from '../lib/auth';

const studentNav = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Subjects', to: '/subjects' },
  { label: 'Mock Exams', to: '/mock-exams' },
];

const adminNav = [
  { label: 'Admin Home', to: '/admin' },
  { label: 'Subjects', to: '/admin/subjects' },
  { label: 'Topics', to: '/admin/topics' },
  { label: 'Questions', to: '/admin/questions' },
  { label: 'Bulk Upload', to: '/admin/bulk-upload' },
  { label: 'Mock Builder', to: '/admin/mock-builder' },
  { label: 'Students', to: '/admin/students' },
];

export default function PageShell({ title, subtitle, action, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();
  const admin = isAdminUser(user);
  const nav = admin ? adminNav : studentNav;

  const logout = () => {
    clearStoredUsers();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate(admin ? '/admin' : '/dashboard')} className="text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-600">Launch Edition</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">ZedExam Pro</h1>
            <p className="text-sm text-slate-500">Professional exam preparation for real ECZ readiness.</p>
          </button>

          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-sm font-semibold text-slate-800">{user?.name || (admin ? 'Administrator' : 'Student')}</p>
              <p className="text-xs text-slate-500">{user?.email || user?.phone || (admin ? 'Admin access' : 'Learner access')}</p>
            </div>
            <button onClick={logout} className="btn btn-danger">Logout</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="card h-fit overflow-hidden p-4">
          <div className="mb-4 rounded-[24px] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.25em] text-blue-200">Workspace</p>
            <p className="mt-2 text-lg font-bold">{admin ? 'Admin control' : 'Student learning'}</p>
            <p className="mt-2 text-sm text-slate-200">
              {admin
                ? 'Manage content, students, and exam readiness from one place.'
                : 'Move from subjects to results and certificates with a cleaner workflow.'}
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:hidden">
            <p className="text-sm font-semibold text-slate-800">{user?.name || (admin ? 'Administrator' : 'Student')}</p>
            <p className="mt-1 text-xs text-slate-500">{user?.email || user?.phone || (admin ? 'Admin access' : 'Learner access')}</p>
            <button onClick={logout} className="btn btn-danger mt-3 w-full">Logout</button>
          </div>

          <nav className="space-y-2">
            {nav.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? 'bg-slate-950 text-white shadow-lg shadow-slate-300/40'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-xs ${active ? 'text-slate-300' : 'text-slate-400'}`}>→</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="space-y-6">
          <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
            <div className="bg-[radial-gradient(circle_at_top_right,_rgba(96,165,250,0.35),_transparent_28%),linear-gradient(135deg,#020617_0%,#0f172a_50%,#1d4ed8_100%)] px-6 py-8 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-200">Workspace</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">{title}</h2>
                  {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">{subtitle}</p> : null}
                </div>
                {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
              </div>
            </div>
          </section>
          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
