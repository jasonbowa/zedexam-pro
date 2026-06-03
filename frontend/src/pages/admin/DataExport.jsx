import { useMemo, useState } from 'react';
import { API_BASE, clearAuth, getToken, isTokenExpired } from '../../api';
import PageShell from '../../components/PageShell';
import { Notice, SectionCard } from '../../components/ui';

const exports = [
  {
    type: 'students',
    title: 'Students',
    description: 'Registered learners, account status, school, and activity counts.',
  },
  {
    type: 'subscriptions',
    title: 'Student Subscriptions',
    description: 'Package assignments, payment proof status, dates, and activation notes.',
  },
  {
    type: 'teacher-material-users',
    title: 'Teacher Materials Users',
    description: 'Teacher Materials accounts, access status, payment proof, and expiry dates.',
  },
  {
    type: 'packages',
    title: 'Packages',
    description: 'Current package names, prices, duration, limits, and active flags.',
  },
  {
    type: 'content-materials',
    title: 'Student Notes & Content',
    description: 'Online notes, subject/topic organization, access level, and quality status.',
  },
  {
    type: 'teacher-materials',
    title: 'Teacher Materials Library',
    description: 'Teacher notes, guides, downloads, subjects, topics, and quality status.',
  },
];

function filenameFromResponse(response, fallback) {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

export default function DataExport() {
  const [busyType, setBusyType] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const downloadExport = async (type) => {
    setBusyType(type);
    setMessage('');
    setError('');

    try {
      const token = getToken();
      if (!token || isTokenExpired(token)) {
        clearAuth();
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }

      const response = await fetch(`${API_BASE}/admin/export/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('Admin login is required before exporting data.');
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Export failed.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFromResponse(response, `zedexam-${type}-${today}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Export downloaded successfully.');
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setBusyType('');
    }
  };

  return (
    <PageShell title="Data Exports" subtitle="Download safe CSV backups for payments, users, packages, and learning materials. Passwords and secrets are never included.">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <SectionCard
        title="Admin Backup Files"
        subtitle="Use these exports before major content updates, deployment changes, or payment reconciliation."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {exports.map((item) => (
            <article key={item.type} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-full flex-col justify-between gap-5">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary w-full sm:w-fit"
                  disabled={busyType === item.type}
                  onClick={() => downloadExport(item.type)}
                >
                  {busyType === item.type ? 'Preparing...' : 'Download CSV'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <Notice tone="info">
        Keep exported files private. They are meant for admin backup and reconciliation, not public sharing.
      </Notice>
    </PageShell>
  );
}
