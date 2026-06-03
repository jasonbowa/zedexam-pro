import { useEffect, useState } from 'react';
import PageShell from '../components/PageShell';
import PaymentInstructions from '../components/PaymentInstructions';
import { authFetch } from '../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../components/ui';

export default function PackagePayment() {
  const [packages, setPackages] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [packageData, planData] = await Promise.allSettled([
          authFetch('/subscriptions/packages'),
          authFetch('/subscriptions/my-plan'),
        ]);
        setPackages(packageData.status === 'fulfilled' && Array.isArray(packageData.value) ? packageData.value : []);
        setSubscription(planData.status === 'fulfilled' ? planData.value?.subscription || null : null);
      } catch (err) {
        setError(err.message || 'Failed to load packages.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const status = subscription?.status || 'Inactive';
  const active = String(status).toUpperCase() === 'ACTIVE';
  const packageName = subscription?.package?.name || 'Select a package';
  const proofStatus = subscription?.proofStatus || (active ? 'CONFIRMED' : 'PENDING');

  return (
    <PageShell title="Packages and Payment" subtitle="Choose a package, pay manually by mobile money, and send proof for activation.">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <PaymentInstructions status={status} packageName={packageName} />

      <SectionCard title="Your Current Access" subtitle="Students can clearly see why access is pending, active, expired, or inactive.">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Package status</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{status}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {active
              ? `Your ${packageName} package is active. Continue using subjects, quizzes, mock exams, results, and certificates where available.`
              : 'After payment confirmation, admin will activate this package so you can use the student practice experience with clearer package-based access.'}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Proof status: {proofStatus}</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Reference: {subscription?.paymentReference || 'Send on WhatsApp'}</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Confirmed: {subscription?.confirmedAt ? new Date(subscription.confirmedAt).toLocaleDateString() : 'Not yet'}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Available Packages" subtitle="Prices and package details are managed by admin.">
        {loading ? <LoadingState text="Loading packages..." /> : null}
        {!loading && packages.length === 0 ? (
          <EmptyState title="No packages published" text="Admin can create packages from the package management screen." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">{pkg.name}</h3>
                <p className="mt-2 text-3xl font-black text-blue-700">K{Number(pkg.priceZmw || 0).toFixed(2)}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{pkg.durationDays} days</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{pkg.description || 'Student practice access with subjects, quizzes, and mock exam support based on admin configuration.'}</p>
                <div className="mt-4 grid gap-2 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Subjects: {pkg.maxSubjects ?? 'Configured by admin'}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Mock exams: {pkg.maxMockExams ?? 'Configured by admin'}</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Online notes and PDFs: package-controlled</div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">Certificates: {pkg.includesCertificates ? 'Included where available' : 'Not included'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
