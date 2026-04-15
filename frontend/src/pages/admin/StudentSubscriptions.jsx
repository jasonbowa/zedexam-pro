
import { useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import { authFetch } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../../components/ui';

const formBlank = { studentId: '', packageId: '', schoolId: '', sponsorName: '', activationCode: '', notes: '', status: 'ACTIVE', startDate: '' };

export default function StudentSubscriptions() {
  const [students, setStudents] = useState([]);
  const [packages, setPackages] = useState([]);
  const [schools, setSchools] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState(formBlank);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [studentData, packageData, schoolData, assignmentData] = await Promise.all([
        authFetch('/admin/students'),
        authFetch('/subscriptions/packages'),
        authFetch('/schools'),
        authFetch('/subscriptions/admin/assignments'),
      ]);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setPackages(Array.isArray(packageData) ? packageData : []);
      setSchools(Array.isArray(schoolData) ? schoolData : []);
      setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
    } catch (err) {
      setError(err.message || 'Failed to load subscription workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const assignPlan = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await authFetch('/subscriptions/assign', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          studentId: Number(form.studentId),
          packageId: Number(form.packageId),
          schoolId: form.schoolId ? Number(form.schoolId) : null,
          startDate: form.startDate || null,
        }),
      });
      setMessage('Subscription assigned successfully.');
      setForm(formBlank);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to assign subscription.');
    }
  };

  return (
    <PageShell title="Student Subscriptions" subtitle="Assign paid or sponsored plans to learners while you prepare full payment integration.">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Assign Package" subtitle="This is the interim commercial workflow before automated mobile money processing is added.">
          <form className="grid gap-4" onSubmit={assignPlan}>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Student
              <select className="rounded-2xl border border-slate-200 px-4 py-3" value={form.studentId} onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))}>
                <option value="">Select student</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name} • {student.phoneNumber || student.phone || ''}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Package
              <select className="rounded-2xl border border-slate-200 px-4 py-3" value={form.packageId} onChange={(e) => setForm((prev) => ({ ...prev, packageId: e.target.value }))}>
                <option value="">Select package</option>
                {packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} • K{Number(pkg.priceZmw || 0).toFixed(2)}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">School Sponsor
              <select className="rounded-2xl border border-slate-200 px-4 py-3" value={form.schoolId} onChange={(e) => setForm((prev) => ({ ...prev, schoolId: e.target.value }))}>
                <option value="">No school sponsor</option>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Sponsor Name<input className="rounded-2xl border border-slate-200 px-4 py-3" value={form.sponsorName} onChange={(e) => setForm((prev) => ({ ...prev, sponsorName: e.target.value }))} /></label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Activation Code<input className="rounded-2xl border border-slate-200 px-4 py-3" value={form.activationCode} onChange={(e) => setForm((prev) => ({ ...prev, activationCode: e.target.value }))} /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Status
                <select className="rounded-2xl border border-slate-200 px-4 py-3" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                  {['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">Start Date<input type="date" className="rounded-2xl border border-slate-200 px-4 py-3" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} /></label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Notes<textarea className="min-h-[96px] rounded-2xl border border-slate-200 px-4 py-3" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} /></label>
            <button className="btn btn-primary">Assign Package</button>
          </form>
        </SectionCard>

        <SectionCard title="Assigned Plans" subtitle="Track which students are on which plans, including sponsored school access.">
          {loading ? <LoadingState text="Loading assignments..." /> : assignments.length === 0 ? <EmptyState title="No plans assigned" text="Assign a package to a student to start tracking plan access." /> : (
            <div className="space-y-4">
              {assignments.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950">{item.student?.name || 'Student'} • {item.package?.name || 'Package'}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.status} • {item.school?.name || item.sponsorName || 'Direct purchase / manual activation'}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Start: {item.startDate ? new Date(item.startDate).toLocaleDateString() : 'Not set'}</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">End: {item.endDate ? new Date(item.endDate).toLocaleDateString() : 'Not set'}</div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Code: {item.activationCode || '—'}</div>
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
