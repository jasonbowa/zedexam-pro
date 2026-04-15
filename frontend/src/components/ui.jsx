export function StatCard({ label, value, hint, accent = 'slate' }) {
  const accents = {
    slate: 'from-slate-900 via-slate-800 to-slate-700 text-white border-slate-800',
    blue: 'from-blue-700 via-blue-600 to-indigo-600 text-white border-blue-700',
    emerald: 'from-emerald-600 via-emerald-500 to-teal-500 text-white border-emerald-600',
    amber: 'from-amber-500 via-orange-500 to-rose-500 text-white border-orange-500',
    white: 'from-white to-white text-slate-900 border-slate-200',
  };

  return (
    <div className={`rounded-[28px] border bg-gradient-to-br p-5 shadow-sm ${accents[accent] || accents.white}`}>
      <p className={`text-sm font-medium ${accent === 'white' ? 'text-slate-500' : 'text-white/80'}`}>{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      {hint ? <p className={`mt-2 text-sm ${accent === 'white' ? 'text-slate-500' : 'text-white/80'}`}>{hint}</p> : null}
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children, padded = true }) {
  return (
    <section className={`card overflow-hidden ${padded ? 'p-6' : ''}`}>
      {(title || action) && (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h3 className="text-xl font-bold text-slate-900">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ tone = 'info', children }) {
  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${styles[tone]}`}>{children}</div>;
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <h4 className="text-lg font-bold text-slate-900">{title}</h4>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{text}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ text = 'Loading...' }) {
  return <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500">{text}</div>;
}

export function ProgressBar({ value = 0 }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-slate-950" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
