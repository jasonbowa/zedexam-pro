import { useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import { authFetch } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard, StatCard } from '../../components/ui';

const blankProof = { paymentReference: '', amountPaid: '', notes: '' };

function statusClass(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'ACTIVE' || value === 'CONFIRMED') return 'badge badge-success';
  if (value === 'REJECTED' || value === 'INACTIVE' || value === 'CANCELLED') return 'badge bg-red-100 text-red-700';
  return 'badge badge-warning';
}

export default function PaymentQueue() {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [counts, setCounts] = useState({ students: 0, teachers: 0, total: 0 });
  const [proofs, setProofs] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFetch('/admin/payment-queue');
      setStudents(Array.isArray(data.students) ? data.students : []);
      setTeachers(Array.isArray(data.teachers) ? data.teachers : []);
      setCounts(data.counts || { students: 0, teachers: 0, total: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load payment queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); }, []);

  const updateProof = (key, field, value) => {
    setProofs((prev) => ({ ...prev, [key]: { ...(prev[key] || blankProof), [field]: value } }));
  };

  const proofPayload = (key) => {
    const proof = proofs[key] || blankProof;
    return {
      paymentReference: proof.paymentReference || undefined,
      amountPaid: proof.amountPaid || undefined,
      notes: proof.notes || undefined,
    };
  };

  const updatePayment = async (type, id, action) => {
    setMessage('');
    setError('');
    const key = `${type}:${id}`;
    const endpoint = type === 'student'
      ? `/admin/payment-queue/student-subscriptions/${id}/${action}`
      : `/admin/payment-queue/teacher-material-users/${id}/${action}`;

    try {
      await authFetch(endpoint, { method: 'PATCH', body: JSON.stringify(proofPayload(key)) });
      setMessage(action === 'activate' ? 'Payment confirmed and access activated.' : 'Access deactivated.');
      setProofs((prev) => ({ ...prev, [key]: blankProof }));
      await loadQueue();
    } catch (err) {
      setError(err.message || 'Failed to update payment status.');
    }
  };

  const renderProofInputs = (key) => {
    const proof = proofs[key] || blankProof;
    return (
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input className="input" value={proof.paymentReference} onChange={(event) => updateProof(key, 'paymentReference', event.target.value)} placeholder="Transaction ID / reference" />
        <input className="input" type="number" min="0" step="0.01" value={proof.amountPaid} onChange={(event) => updateProof(key, 'amountPaid', event.target.value)} placeholder="Amount paid" />
        <input className="input" value={proof.notes} onChange={(event) => updateProof(key, 'notes', event.target.value)} placeholder="Internal note" />
      </div>
    );
  };

  return (
    <PageShell title="Payment Queue" subtitle="Confirm Mobile Money payments and activate student or Teacher Materials access from one place.">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Pending Total" value={loading ? '...' : counts.total} hint="Student and Teacher Materials" accent="amber" />
        <StatCard label="Student Payments" value={loading ? '...' : counts.students} hint="Package subscriptions" accent="blue" />
        <StatCard label="Teacher Payments" value={loading ? '...' : counts.teachers} hint="Materials access" accent="emerald" />
      </div>

      <SectionCard title="Student Package Payments" subtitle="Use the registered phone number and transaction reference before activating access.">
        {loading ? <LoadingState text="Loading student payments..." /> : null}
        {!loading && students.length === 0 ? (
          <EmptyState title="No pending student payments" text="Students with pending or inactive package payment records will appear here." />
        ) : (
          <div className="space-y-4">
            {students.map((item) => {
              const key = `student:${item.id}`;
              return (
                <article key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={statusClass(item.status)}>{item.status || 'PENDING'}</span>
                        <span className={statusClass(item.proofStatus)}>{item.proofStatus || 'PENDING'} proof</span>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{item.student?.name || 'Student'} / {item.package?.name || 'Package'}</h3>
                      <p className="mt-1 text-sm text-slate-500">{item.student?.phoneNumber || item.student?.phone || 'No phone'} / K{Number(item.package?.priceZmw || 0).toFixed(2)} / {item.package?.durationDays || 30} days</p>
                      <p className="mt-2 text-sm text-slate-600">Reference: {item.paymentReference || 'Awaiting WhatsApp proof'} / Amount: {item.amountPaid ? `K${Number(item.amountPaid).toFixed(2)}` : 'Not recorded'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-success" onClick={() => updatePayment('student', item.id, 'activate')}>Activate</button>
                      <button className="btn btn-danger" onClick={() => updatePayment('student', item.id, 'deactivate')}>Deactivate</button>
                    </div>
                  </div>
                  {renderProofInputs(key)}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Teacher Materials Payments" subtitle="Teachers only receive notes, guides, and downloadable materials after activation.">
        {loading ? <LoadingState text="Loading teacher payments..." /> : null}
        {!loading && teachers.length === 0 ? (
          <EmptyState title="No pending teacher payments" text="Teacher Materials users with pending or inactive payment records will appear here." />
        ) : (
          <div className="space-y-4">
            {teachers.map((user) => {
              const key = `teacher:${user.id}`;
              return (
                <article key={user.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={statusClass(user.status)}>{user.status || 'PENDING'}</span>
                        <span className={statusClass(user.proofStatus)}>{user.proofStatus || 'PENDING'} proof</span>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{user.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{user.phone || user.phoneNumber} / {user.package || 'Teacher Materials'} / {user.email || 'No email'}</p>
                      <p className="mt-2 text-sm text-slate-600">Reference: {user.paymentReference || 'Awaiting WhatsApp proof'} / Amount: {user.amountPaid ? `K${Number(user.amountPaid).toFixed(2)}` : 'Not recorded'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-success" onClick={() => updatePayment('teacher', user.id, 'activate')}>Activate</button>
                      <button className="btn btn-danger" onClick={() => updatePayment('teacher', user.id, 'deactivate')}>Deactivate</button>
                    </div>
                  </div>
                  {renderProofInputs(key)}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
