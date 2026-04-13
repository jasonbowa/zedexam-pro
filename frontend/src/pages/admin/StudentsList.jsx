import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../../api';
import PageShell from '../../components/PageShell';
import { EmptyState, LoadingState, Notice, SectionCard, StatCard } from '../../components/ui';

const gradeOptions = [
  'FORM_1',
  'FORM_2',
  'FORM_3',
  'FORM_4',
  'GRADE_10',
  'GRADE_11',
  'GRADE_12',
];

const emptyForm = {
  name: '',
  phoneNumber: '',
  email: '',
  grade: 'FORM_1',
  school: '',
  password: '',
  isActive: true,
};

function formatGrade(value) {
  return String(value || '').replace(/_/g, ' ') || '—';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function normalizeStudentStatus(student) {
  if (!student) return 'unknown';
  if (student.status) return String(student.status).toLowerCase();
  if (student.deletedAt) return 'deleted';
  if (student.isActive === false) return 'inactive';
  return 'active';
}

export default function StudentsList() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFetch('/admin/students?includeDeleted=true');
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      setStudents([]);
      setError(err.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const haystack = [
        student.name,
        student.phoneNumber,
        student.phone,
        student.email,
        student.school,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      const studentStatus = normalizeStudentStatus(student);
      const matchesStatus = statusFilter === 'all' || studentStatus === statusFilter;
      const matchesGrade = gradeFilter === 'all' || student.grade === gradeFilter;

      return matchesSearch && matchesStatus && matchesGrade;
    });
  }, [students, search, statusFilter, gradeFilter]);

  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((student) => normalizeStudentStatus(student) === 'active').length;
    const inactive = students.filter((student) => normalizeStudentStatus(student) === 'inactive').length;
    const deleted = students.filter((student) => normalizeStudentStatus(student) === 'deleted').length;
    return { total, active, inactive, deleted };
  }, [students]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setEditingStudent(null);
    setForm(emptyForm);
  };

  const startEdit = (student) => {
    setEditingStudent(student);
    setError('');
    setSuccess('');
    setForm({
      name: student.name || '',
      phoneNumber: student.phoneNumber || student.phone || '',
      email: student.email || '',
      grade: student.grade || 'FORM_1',
      school: student.school || '',
      password: '',
      isActive: student.isActive !== false && normalizeStudentStatus(student) !== 'deleted',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const payload = {
      name: form.name.trim(),
      phoneNumber: form.phoneNumber.trim(),
      email: form.email.trim() || null,
      grade: form.grade,
      school: form.school.trim() || null,
      isActive: Boolean(form.isActive),
    };

    if (form.password.trim()) {
      payload.password = form.password.trim();
    }

    if (!editingStudent && !payload.password) {
      setSubmitting(false);
      setError('A password is required when creating a student.');
      return;
    }

    try {
      if (editingStudent) {
        await authFetch(`/admin/students/${editingStudent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccess('Student updated successfully.');
      } else {
        await authFetch('/admin/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Student created successfully.');
      }

      resetForm();
      await loadStudents();
    } catch (err) {
      setError(err.message || 'Failed to save student.');
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (studentId, action, options = {}) => {
    setActiveStudentId(studentId);
    setError('');
    setSuccess('');

    try {
      await authFetch(action, options);
      setSuccess(options.successMessage || 'Student action completed successfully.');
      if (editingStudent?.id === studentId) {
        resetForm();
      }
      await loadStudents();
    } catch (err) {
      setError(err.message || 'Student action failed.');
    } finally {
      setActiveStudentId(null);
    }
  };

  const handleDeactivate = async (student) => {
    if (!window.confirm(`Deactivate ${student.name}? They will not be able to log in until reactivated.`)) {
      return;
    }

    await runAction(student.id, `/admin/students/${student.id}/deactivate`, {
      method: 'PATCH',
      successMessage: 'Student deactivated successfully.',
    });
  };

  const handleActivate = async (student) => {
    await runAction(student.id, `/admin/students/${student.id}/activate`, {
      method: 'PATCH',
      successMessage: 'Student activated successfully.',
    });
  };

  const handleRestore = async (student) => {
    await runAction(student.id, `/admin/students/${student.id}/restore`, {
      method: 'PATCH',
      successMessage: 'Student restored successfully.',
    });
  };

  const handleRemove = async (student) => {
    if (!window.confirm(`Remove ${student.name}? This keeps the record for later restore.`)) {
      return;
    }

    await runAction(student.id, `/admin/students/${student.id}`, {
      method: 'DELETE',
      successMessage: 'Student removed successfully.',
    });
  };

  const handlePermanentDelete = async (student) => {
    if (!window.confirm(`Permanently delete ${student.name}? This cannot be undone.`)) {
      return;
    }

    await runAction(student.id, `/admin/students/${student.id}?hard=true`, {
      method: 'DELETE',
      successMessage: 'Student permanently deleted.',
    });
  };

  const handleResetPassword = async (student) => {
    const nextPassword = window.prompt(`Enter a new password for ${student.name}:`);
    if (!nextPassword) return;

    await runAction(student.id, `/admin/students/${student.id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ password: nextPassword }),
      successMessage: 'Student password reset successfully.',
    });
  };

  const action = (
    <>
      <Link to="/admin" className="btn bg-white text-slate-950 hover:bg-slate-100">Admin Home</Link>
      <button className="btn btn-secondary" onClick={() => { resetForm(); setSuccess('Ready to add a new student.'); }}>
        Add Student
      </button>
      <button className="btn btn-secondary" onClick={loadStudents}>
        Refresh
      </button>
    </>
  );

  return (
    <PageShell
      title="Students Management"
      subtitle="Register learners, edit details, activate or deactivate access, restore removed accounts, and reset student passwords from one place."
      action={action}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={loading ? '...' : stats.total} hint="Including removed accounts" accent="slate" />
        <StatCard label="Active" value={loading ? '...' : stats.active} hint="Can log in" accent="emerald" />
        <StatCard label="Inactive" value={loading ? '...' : stats.inactive} hint="Needs reactivation" accent="amber" />
        <StatCard label="Removed" value={loading ? '...' : stats.deleted} hint="Can be restored" accent="white" />
      </div>

      <SectionCard
        title={editingStudent ? `Edit Student #${editingStudent.id}` : 'Register Student'}
        subtitle={editingStudent ? 'Update learner details or change account access.' : 'Create a new learner account directly from admin.'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
            <input className="input" value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="Enter student name" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Phone Number</label>
            <input className="input" value={form.phoneNumber} onChange={(e) => updateForm('phoneNumber', e.target.value)} placeholder="0977123456" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Email Address</label>
            <input className="input" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} placeholder="Optional email" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Grade</label>
            <select className="input" value={form.grade} onChange={(e) => updateForm('grade', e.target.value)}>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>{formatGrade(grade)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">School</label>
            <input className="input" value={form.school} onChange={(e) => updateForm('school', e.target.value)} placeholder="Optional school name" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {editingStudent ? 'New Password (optional)' : 'Password'}
            </label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => updateForm('password', e.target.value)}
              placeholder={editingStudent ? 'Leave blank to keep current password' : 'Create password'}
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateForm('isActive', e.target.checked)}
              />
              Student account active
            </label>

            <div className="flex flex-wrap gap-3">
              {editingStudent ? (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel Edit</button>
              ) : null}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : editingStudent ? 'Update Student' : 'Create Student'}
              </button>
            </div>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Student Directory" subtitle="Search and manage student accounts across active, inactive, and removed records.">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Search</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, or school"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deleted">Removed</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Grade</label>
            <select className="input" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
              <option value="all">All grades</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>{formatGrade(grade)}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="mt-5">
            <LoadingState text="Loading students..." />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="No students found"
              text="Try changing the search text or filters. You can also create a new student from the form above."
            />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Grade</th>
                  <th className="px-4 py-3 font-semibold">School</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Activity</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const status = normalizeStudentStatus(student);
                  const busy = activeStudentId === student.id;

                  return (
                    <tr key={student.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{student.name}</div>
                        <div className="mt-1 text-slate-600">{student.phoneNumber || student.phone || '—'}</div>
                        <div className="mt-1 text-xs text-slate-500">{student.email || 'No email address'}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{formatGrade(student.grade)}</td>
                      <td className="px-4 py-4 text-slate-700">{student.school || '—'}</td>
                      <td className="px-4 py-4">
                        <span className={`badge ${
                          status === 'active'
                            ? 'badge-success'
                            : status === 'inactive'
                              ? 'badge-warning'
                              : 'badge-danger'
                        }`}>
                          {status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : 'Removed'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div>Attempts: {student.attemptsCount || 0}</div>
                        <div className="mt-1 text-xs">Last login: {formatDate(student.lastLoginAt)}</div>
                        <div className="mt-1 text-xs">Created: {formatDate(student.createdAt)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="btn btn-secondary" onClick={() => startEdit(student)} disabled={busy}>Edit</button>

                          {status === 'active' ? (
                            <button className="btn btn-secondary" onClick={() => handleDeactivate(student)} disabled={busy}>
                              {busy ? 'Working...' : 'Deactivate'}
                            </button>
                          ) : null}

                          {status === 'inactive' ? (
                            <button className="btn btn-success" onClick={() => handleActivate(student)} disabled={busy}>
                              {busy ? 'Working...' : 'Activate'}
                            </button>
                          ) : null}

                          {status !== 'deleted' ? (
                            <button className="btn btn-secondary" onClick={() => handleResetPassword(student)} disabled={busy}>Reset Password</button>
                          ) : null}

                          {status !== 'deleted' ? (
                            <button className="btn btn-danger" onClick={() => handleRemove(student)} disabled={busy}>
                              {busy ? 'Working...' : 'Remove'}
                            </button>
                          ) : (
                            <>
                              <button className="btn btn-success" onClick={() => handleRestore(student)} disabled={busy}>
                                {busy ? 'Working...' : 'Restore'}
                              </button>
                              <button className="btn btn-danger" onClick={() => handlePermanentDelete(student)} disabled={busy}>
                                {busy ? 'Working...' : 'Delete Forever'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
