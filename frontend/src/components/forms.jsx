export function AdminCard({ title, subtitle, action, children }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {(title || subtitle || action) ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="text-xl font-bold text-slate-950">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FormLabel({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
      {children}
    </label>
  );
}

const controlClass =
  'input min-h-[48px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

export function FormInput({ label, id, className = '', ...props }) {
  return (
    <div className="grid gap-2">
      {label ? <FormLabel htmlFor={id}>{label}</FormLabel> : null}
      <input id={id} className={`${controlClass} ${className}`} {...props} />
    </div>
  );
}

export function FormSelect({ label, id, children, className = '', ...props }) {
  return (
    <div className="grid gap-2">
      {label ? <FormLabel htmlFor={id}>{label}</FormLabel> : null}
      <select id={id} className={`${controlClass} ${className}`} {...props}>
        {children}
      </select>
    </div>
  );
}

export function FormTextarea({ label, id, className = '', rows = 4, ...props }) {
  return (
    <div className="grid gap-2">
      {label ? <FormLabel htmlFor={id}>{label}</FormLabel> : null}
      <textarea id={id} rows={rows} className={`${controlClass} min-h-[110px] resize-y ${className}`} {...props} />
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{children}</div>;
}

export function FormSuccess({ children }) {
  if (!children) return null;
  return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{children}</div>;
}

export function PrimaryButton({ className = '', ...props }) {
  return <button className={`btn btn-primary min-h-[44px] ${className}`} {...props} />;
}
