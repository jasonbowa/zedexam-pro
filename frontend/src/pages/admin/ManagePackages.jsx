
import { useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import { authFetch } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../../components/ui';

const blankPackage = {
  name: '',
  description: '',
  durationDays: 30,
  priceZmw: 0,
  maxSubjects: '',
  maxMockExams: '',
  includesReports: false,
  includesCertificates: true,
  active: true,
};

export default function ManagePackages() {
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState(blankPackage);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPackages = async () => {
    setLoading(true);
    try {
      const data = await authFetch('/subscriptions/packages');
      setPackages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load packages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPackages(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        durationDays: Number(form.durationDays || 30),
        priceZmw: Number(form.priceZmw || 0),
        maxSubjects: form.maxSubjects === '' ? null : Number(form.maxSubjects),
        maxMockExams: form.maxMockExams === '' ? null : Number(form.maxMockExams),
      };
      await authFetch(editingId ? `/subscriptions/packages/${editingId}` : '/subscriptions/packages', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(editingId ? 'Package updated successfully.' : 'Package created successfully.');
      setForm(blankPackage);
      setEditingId(null);
      await loadPackages();
    } catch (err) {
      setError(err.message || 'Failed to save package.');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      description: item.description || '',
      durationDays: item.durationDays || 30,
      priceZmw: Number(item.priceZmw || 0),
      maxSubjects: item.maxSubjects ?? '',
      maxMockExams: item.maxMockExams ?? '',
      includesReports: !!item.includesReports,
      includesCertificates: item.includesCertificates !== false,
      active: item.active !== false,
    });
  };

  const removePackage = async (id) => {
    if (!window.confirm('Delete this package?')) return;
    try {
      await authFetch(`/subscriptions/packages/${id}`, { method: 'DELETE' });
      setMessage('Package deleted successfully.');
      await loadPackages();
    } catch (err) {
      setError(err.message || 'Failed to delete package.');
    }
  };

  return (
    <PageShell title="Manage Subscription Packages" subtitle="Create daily, weekly, monthly, or sponsored plan structures for monetization.">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title={editingId ? 'Edit Package' : 'Create Package'} subtitle="Use this to prepare pricing and access tiers before mobile money integration.">
          <form className="grid gap-4" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Package Name<input className="rounded-2xl border border-slate-200 px-4 py-3" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Description<textarea className="min-h-[90px] rounded-2xl border border-slate-200 px-4 py-3" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Duration (days)<input type="number" className="rounded-2xl border border-slate-200 px-4 py-3" value={form.durationDays} onChange={(e) => setForm((prev) => ({ ...prev, durationDays: e.target.value }))} /></label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Price (ZMW)<input type="number" className="rounded-2xl border border-slate-200 px-4 py-3" value={form.priceZmw} onChange={(e) => setForm((prev) => ({ ...prev, priceZmw: e.target.value }))} /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Max Subjects<input type="number" className="rounded-2xl border border-slate-200 px-4 py-3" value={form.maxSubjects} onChange={(e) => setForm((prev) => ({ ...prev, maxSubjects: e.target.value }))} /></label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Max Mock Exams<input type="number" className="rounded-2xl border border-slate-200 px-4 py-3" value={form.maxMockExams} onChange={(e) => setForm((prev) => ({ ...prev, maxMockExams: e.target.value }))} /></label>
            </div>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              {[
                ['includesReports', 'Include Reports'],
                ['includesCertificates', 'Include Certificates'],
                ['active', 'Active'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                  <input type="checkbox" checked={!!form[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary">{editingId ? 'Update Package' : 'Create Package'}</button>
              {editingId ? <button type="button" className="btn border border-slate-300 bg-white text-slate-900" onClick={() => { setEditingId(null); setForm(blankPackage); }}>Cancel</button> : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Package Catalog" subtitle="These plans can later be linked to MoMo or Airtel Money payment flows.">
          {loading ? <LoadingState text="Loading packages..." /> : packages.length === 0 ? <EmptyState title="No packages yet" text="Create the first pricing plan so subscriptions can be assigned to students." /> : (
            <div className="space-y-4">
              {packages.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{item.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">K{Number(item.priceZmw || 0).toFixed(2)} • {item.durationDays} days • {item.active ? 'Active' : 'Inactive'}</p>
                      <p className="mt-2 text-sm text-slate-600">{item.description || 'No description provided.'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn border border-slate-300 bg-white text-slate-900" onClick={() => startEdit(item)}>Edit</button>
                      <button className="btn border border-red-200 bg-red-50 text-red-700" onClick={() => removePackage(item.id)}>Delete</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Max Subjects: {item.maxSubjects ?? 'Unlimited'}</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Mock Exams: {item.maxMockExams ?? 'Unlimited'}</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Reports: {item.includesReports ? 'Yes' : 'No'}</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Certificates: {item.includesCertificates ? 'Yes' : 'No'}</div>
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
