export const PAYMENT_PHONE = '0968955959';
export const WHATSAPP_PAYMENT_URL = 'https://wa.me/260968955959';

export default function PaymentInstructions({ packageName, status = 'Pending', title = 'How to activate your package' }) {
  return (
    <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Package status: {status}</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{title}</h3>
          {packageName ? <p className="mt-1 text-sm font-semibold text-slate-700">Selected package: {packageName}</p> : null}
        </div>
        <a className="btn bg-emerald-600 text-white hover:bg-emerald-700" href={WHATSAPP_PAYMENT_URL} target="_blank" rel="noreferrer">
          Send Payment Proof on WhatsApp
        </a>
      </div>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-800">
        <li>Pay via Mobile Money to: <strong>{PAYMENT_PHONE}</strong></li>
        <li>Use your registered phone number as the payment reference where possible.</li>
        <li>After payment, send proof on WhatsApp to: <strong>{PAYMENT_PHONE}</strong></li>
        <li>Include your full name, registered phone number, selected package, and transaction ID or payment reference.</li>
        <li>Your account will be activated after confirmation.</li>
      </ol>

      <div className="mt-4 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800">
        Use the same phone number you registered with to avoid activation delays.
      </div>
    </section>
  );
}
