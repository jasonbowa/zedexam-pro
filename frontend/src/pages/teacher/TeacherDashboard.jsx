import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../../components/PageShell';
import PaymentInstructions from '../../components/PaymentInstructions';
import { authFetch, getStoredUser } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard, StatCard } from '../../components/ui';

const typeLabels = {
  TEACHER_NOTE: 'Teacher Notes',
  TEACHER_GUIDE: 'Teacher Guides',
  DOWNLOAD: 'Downloads',
};

function isActiveAccess(access) {
  return access?.isActive === true && String(access?.status || '').toUpperCase() === 'ACTIVE';
}

export default function TeacherDashboard() {
  const storedUser = useMemo(() => getStoredUser(), []);
  const [profile, setProfile] = useState(storedUser);
  const [access, setAccess] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const me = await authFetch('/teacher-materials/me');
        setProfile(me.user || storedUser);
        setAccess(me.access || null);

        if (isActiveAccess(me.access)) {
          const data = await authFetch('/content-materials/teacher');
          setMaterials(Array.isArray(data) ? data : []);
        } else {
          setMaterials([]);
        }
      } catch (err) {
        setError(err.message || 'Failed to load Teacher Materials dashboard.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storedUser]);

  const counts = useMemo(() => {
    return materials.reduce((acc, item) => {
      acc[item.contentType] = (acc[item.contentType] || 0) + 1;
      return acc;
    }, {});
  }, [materials]);

  const active = isActiveAccess(access);
  const status = access?.status || profile?.status || 'Pending';
  const packageName = access?.package || profile?.package || 'Teacher Materials';

  const changePassword = async (event) => {
    event.preventDefault();
    setError('');
    setPasswordMessage('');
    try {
      await authFetch('/teacher-materials/change-password', {
        method: 'POST',
        body: JSON.stringify(passwordForm),
      });
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setPasswordMessage('Password changed successfully.');
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    }
  };

  return (
    <PageShell
      title={`Teacher Materials${profile?.name ? ` for ${profile.name.split(' ')[0]}` : ''}`}
      subtitle="Access teaching notes, guides, downloadable support material, and exam-style classroom resources."
      action={
        <>
          <Link className="btn bg-white text-slate-950 hover:bg-slate-100" to="/teacher/notes">Teacher Notes</Link>
          <Link className="btn border border-white/20 bg-white/10 text-white hover:bg-white/20" to="/teacher/guides">Teacher Guides</Link>
        </>
      }
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Access Status" value={loading ? '...' : status} hint={active ? 'Materials unlocked' : 'Payment confirmation required'} accent={active ? 'emerald' : 'amber'} />
        <StatCard label="Teacher Notes" value={loading ? '...' : counts.TEACHER_NOTE || 0} hint="Structured lesson support" accent="slate" />
        <StatCard label="Teacher Guides" value={loading ? '...' : counts.TEACHER_GUIDE || 0} hint="Teaching method support" accent="blue" />
        <StatCard label="Downloads" value={loading ? '...' : counts.DOWNLOAD || 0} hint="PDF links where available" accent="white" />
      </div>

      {!active ? (
        <PaymentInstructions status={status} packageName={packageName} />
      ) : null}

      <SectionCard title="What You Can Access" subtitle={active ? 'Your Teacher Materials package is active.' : 'These areas unlock after admin confirms payment.'}>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['Teacher Notes', '/teacher/notes', 'Subject, grade, topic, objectives, concepts, and classroom explanations.'],
            ['Teacher Guides', '/teacher/guides', 'Teaching methods, common learner difficulties, assessment questions, and marking guidance.'],
            ['Downloads', '/teacher/downloads', 'Downloadable PDFs or links where the admin has attached files.'],
          ].map(([title, to, text]) => (
            <Link key={title} to={to} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <h3 className="text-lg font-bold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              <p className="mt-4 text-sm font-bold text-blue-700">Open -&gt;</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent Teacher Materials" subtitle="Latest active notes, guides, and downloads in the library.">
        {loading ? <LoadingState text="Loading materials..." /> : null}
        {!loading && active && materials.length === 0 ? (
          <EmptyState title="No materials published yet" text="Admin can add teacher notes, guides, and downloads from the Teacher Materials admin screen." />
        ) : null}
        {!loading && active && materials.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {materials.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <span className="badge badge-info">{typeLabels[item.contentType] || item.contentType}</span>
                <h3 className="mt-3 text-lg font-bold text-slate-950">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{[item.subject, item.grade, item.topic].filter(Boolean).join(' / ') || 'General resource'}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.content || item.examStyleGuidance || 'Structured teacher material ready for classroom support.'}</p>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Account Security" subtitle="Change your Teacher Materials password while you still know your current one. If you forgot it, admin can reset it.">
        {passwordMessage ? <Notice tone="success">{passwordMessage}</Notice> : null}
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={changePassword}>
          <input className="input" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))} placeholder="Current password" />
          <input className="input" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))} placeholder="New password" />
          <button className="btn btn-primary" type="submit">Change Password</button>
        </form>
      </SectionCard>
    </PageShell>
  );
}
