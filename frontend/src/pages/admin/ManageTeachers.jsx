
import { useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import { authFetch } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../../components/ui';

const initialForm = { fullName: '', email: '', phoneNumber: '', subject: '', schoolId: '' };

export default function ManageTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [teacherData, schoolData] = await Promise.all([authFetch('/teachers'), authFetch('/schools')]);
      setTeachers(Array.isArray(teacherData) ? teacherData : []);
      setSchools(Array.isArray(schoolData) ? schoolData : []);
    } catch (err) {
      setError(err.message || 'Failed to load teacher data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await authFetch(editingId ? `/teachers/${editingId}` : '/teachers', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, schoolId: form.schoolId || null }),
      });
      setMessage(editingId ? 'Teacher updated successfully.' : 'Teacher created successfully.');
      setForm(initialForm);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err.message || 'Failed to save teacher.');
    }
  };

  const startEdit = (teacher) => {
    setEditingId(teacher.id);
    setForm({
      fullName: teacher.fullName || '',
      email: teacher.email || '',
      phoneNumber: teacher.phoneNumber || '',
      subject: teacher.subject || '',
      schoolId: teacher.schoolId ? String(teacher.schoolId) : '',
    });
  };

  const removeTeacher = async (id) => {
    if (!window.confirm('Delete this teacher?')) return;
    try {
      await authFetch(`/teachers/${id}`, { method: 'DELETE' });
      setMessage('Teacher deleted successfully.');
      await loadAll();
    } catch (err) {
      setError(err.message || 'Failed to delete teacher.');
    }
  };

  return (
    <PageShell title="Manage Teachers" subtitle="Prepare school-facing operations by storing teacher profiles and linking them to institutions.">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title={editingId ? 'Edit Teacher' : 'Create Teacher'} subtitle="These records prepare the ground for later school dashboards and assignment workflows.">
          <form className="grid gap-4" onSubmit={submit}>
            {[
              ['fullName', 'Full Name'],
              ['email', 'Email'],
              ['phoneNumber', 'Phone Number'],
              ['subject', 'Subject / Role'],
            ].map(([key, label]) => (
              <label key={key} className="grid gap-2 text-sm font-semibold text-slate-700">
                {label}
                <input className="rounded-2xl border border-slate-200 px-4 py-3" value={form[key]} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />
              </label>
            ))}
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              School
              <select className="rounded-2xl border border-slate-200 px-4 py-3" value={form.schoolId} onChange={(e) => setForm((prev) => ({ ...prev, schoolId: e.target.value }))}>
                <option value="">No school assigned</option>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary">{editingId ? 'Update Teacher' : 'Create Teacher'}</button>
              {editingId ? <button type="button" className="btn border border-slate-300 bg-white text-slate-900" onClick={() => { setEditingId(null); setForm(initialForm); }}>Cancel</button> : null}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Teacher Directory" subtitle="This list becomes useful once you begin school outreach and teacher onboarding.">
          {loading ? <LoadingState text="Loading teachers..." /> : teachers.length === 0 ? <EmptyState title="No teachers yet" text="Create teacher records to organize school partnerships." /> : (
            <div className="space-y-4">
              {teachers.map((teacher) => (
                <div key={teacher.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{teacher.fullName}</h3>
                      <p className="mt-1 text-sm text-slate-500">{teacher.subject || 'Teacher'} • {teacher.school?.name || 'No school assigned'}</p>
                      <p className="mt-2 text-sm text-slate-600">{teacher.email || 'No email'} • {teacher.phoneNumber || 'No phone'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn border border-slate-300 bg-white text-slate-900" onClick={() => startEdit(teacher)}>Edit</button>
                      <button className="btn border border-red-200 bg-red-50 text-red-700" onClick={() => removeTeacher(teacher.id)}>Delete</button>
                    </div>
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
