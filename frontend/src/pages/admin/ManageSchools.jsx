
import { useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import { authFetch } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../../components/ui';

const initialForm = { name: '', code: '', contactName: '', contactPhone: '', contactEmail: '', address: '', status: 'active' };

export default function ManageSchools() {
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadSchools = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFetch('/schools');
      setSchools(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load schools.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSchools(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const method = editingId ? 'PUT' : 'POST';
      const endpoint = editingId ? `/schools/${editingId}` : '/schools';
      await authFetch(endpoint, { method, body: JSON.stringify(form) });
      setMessage(editingId ? 'School updated successfully.' : 'School created successfully.');
      setForm(initialForm);
      setEditingId(null);
      await loadSchools();
    } catch (err) {
      setError(err.message || 'Failed to save school.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (school) => {
    setEditingId(school.id);
    setForm({
      name: school.name || '',
      code: school.code || '',
      contactName: school.contactName || '',
      contactPhone: school.contactPhone || '',
      contactEmail: school.contactEmail || '',
      address: school.address || '',
      status: school.status || 'active',
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this school?')) return;
    try {
      await authFetch(`/schools/${id}`, { method: 'DELETE' });
      setMessage('School deleted successfully.');
      await loadSchools();
    } catch (err) {
      setError(err.message || 'Failed to delete school.');
    }
  };

  return (
    <PageShell title="Manage Schools" subtitle="Create partner schools, assign codes, and prepare the platform for institutional rollout.">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title={editingId ? 'Edit School' : 'Create School'} subtitle="Store institution details for teacher and subscription assignments.">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            {[
              ['name', 'School Name'],
              ['code', 'School Code'],
              ['contactName', 'Contact Name'],
              ['contactPhone', 'Contact Phone'],
              ['contactEmail', 'Contact Email'],
            ].map(([key, label]) => (
              <label key={key} className="grid gap-2 text-sm font-semibold text-slate-700">
                {label}
                <input className="rounded-2xl border border-slate-200 px-4 py-3" value={form[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />
              </label>
            ))}
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Address
              <textarea className="min-h-[96px] rounded-2xl border border-slate-200 px-4 py-3" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Status
              <select className="rounded-2xl border border-slate-200 px-4 py-3" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="prospect">prospect</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update School' : 'Create School'}</button>
              {editingId ? <button type="button" className="btn border border-slate-300 bg-white text-slate-900" onClick={() => { setEditingId(null); setForm(initialForm); }}>Cancel</button> : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="School Directory" subtitle="Every school created here becomes available for teachers and subscription sponsorships.">
          {loading ? <LoadingState text="Loading schools..." /> : schools.length === 0 ? <EmptyState title="No schools yet" text="Create the first school record to start assigning teachers and sponsored plans." /> : (
            <div className="space-y-4">
              {schools.map((school) => (
                <div key={school.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{school.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{school.code || 'No code'} • {school.status || 'active'}</p>
                      <p className="mt-2 text-sm text-slate-600">{school.contactName || 'No contact'} • {school.contactPhone || 'No phone'} • {school.contactEmail || 'No email'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn border border-slate-300 bg-white text-slate-900" onClick={() => startEdit(school)}>Edit</button>
                      <button className="btn border border-red-200 bg-red-50 text-red-700" onClick={() => handleDelete(school.id)}>Delete</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Students: {school._count?.students || 0}</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Teachers: {school._count?.teachers || 0}</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Plans: {school._count?.packages || 0}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}
