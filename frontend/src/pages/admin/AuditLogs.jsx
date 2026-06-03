import { useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import { authFetch } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../../components/ui';

function formatDate(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async (nextLimit = limit) => {
    setLoading(true);
    setError('');
    try {
      const data = await authFetch(`/admin/audit-logs?limit=${nextLimit}`);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(limit); }, []);

  return (
    <PageShell
      title="Audit Logs"
      subtitle="Review admin actions, payment confirmations, content publishing, password resets, and login activity."
      action={
        <>
          <select className="input h-11 bg-white text-slate-900" value={limit} onChange={(event) => { const value = Number(event.target.value); setLimit(value); loadLogs(value); }}>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={200}>Last 200</option>
            <option value={500}>Last 500</option>
          </select>
          <button className="btn bg-white text-slate-950 hover:bg-slate-100" onClick={() => loadLogs(limit)}>Refresh</button>
        </>
      }
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <SectionCard title="Recent Platform Activity" subtitle={`${logs.length} audit event(s) loaded.`}>
        {loading ? <LoadingState text="Loading audit logs..." /> : null}
        {!loading && logs.length === 0 ? (
          <EmptyState title="No audit logs found" text="Admin activity will appear here after actions are performed." />
        ) : (
          <div className="space-y-3">
            {logs.map((log, index) => (
              <article key={`${log.at || 'log'}-${index}`} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{formatDate(log.at)}</p>
                    <h3 className="mt-1 text-base font-black text-slate-950">{log.event || 'Audit event'}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Actor: {log.actorId || 'system'} / Role: {log.actorRole || 'n/a'} / IP: {log.ip || 'n/a'}
                    </p>
                  </div>
                  <span className="badge bg-slate-100 text-slate-700">{log.method || 'event'}</span>
                </div>
                {log.path ? <p className="mt-2 text-sm font-semibold text-slate-600">{log.path}</p> : null}
                {log.details ? (
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-700 ring-1 ring-slate-200">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
