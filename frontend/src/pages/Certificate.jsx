import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from '../api';
import PageShell from '../components/PageShell';
import { LoadingState, Notice, SectionCard } from '../components/ui';

export default function Certificate() {
  const { resultId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        const data = await authFetch(`/results/${resultId}`);
        setResult(data || null);
      } catch (err) {
        setError(err.message || 'Failed to load certificate.');
      } finally { setLoading(false); }
    };
    load();
  }, [resultId]);

  const percent = result?.percentage || 0;

  if (loading) return <PageShell title="Certificate" subtitle="Generating learner certificate view."><LoadingState text="Loading certificate..." /></PageShell>;
  if (error) return <PageShell title="Certificate" subtitle="A certificate could not be loaded."><Notice tone="danger">{error}</Notice></PageShell>;
  if (!result || percent < 50) return <PageShell title="Certificate" subtitle="Certificates are available only for passed attempts."><Notice tone="warning">This result is not eligible for a certificate yet.</Notice></PageShell>;

  return (
    <PageShell title="Certificate of Achievement" subtitle="Printable learner certificate for a passed topic attempt." action={<button className="btn bg-white text-slate-950 hover:bg-slate-100" onClick={() => window.print()}>Print Certificate</button>}>
      <SectionCard padded={false}>
        <div className="rounded-[34px] border-[10px] border-amber-400 bg-[linear-gradient(135deg,#fffdf4_0%,#ffffff_40%,#eff6ff_100%)] p-8 shadow-xl sm:p-12 print:shadow-none">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.45em] text-blue-700">ZedExam Pro</p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Certificate of Achievement</h1>
            <p className="mt-4 text-base leading-8 text-slate-600">This certificate is proudly awarded to</p>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{result.student?.name || 'Student'}</h2>
            <p className="mt-6 text-base leading-8 text-slate-600">
              for successfully completing <span className="font-bold text-slate-900">{result.topicName || result.title || 'this topic'}</span> with a score of <span className="font-bold text-slate-900">{percent}%</span>.
            </p>

            <div className="mt-10 grid gap-6 border-t border-dashed border-slate-300 pt-8 sm:grid-cols-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Awarded to</p><p className="mt-2 text-sm font-semibold text-slate-900">{result.student?.name || 'Student'}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Achievement</p><p className="mt-2 text-sm font-semibold text-slate-900">Passed topic assessment</p></div>
              <div><p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Result</p><p className="mt-2 text-sm font-semibold text-slate-900">{percent}%</p></div>
            </div>

            {result.certificate ? (
              <div className="mt-10 rounded-[24px] border border-slate-200 bg-white/80 p-5 text-left">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Verification</p>
                <p className="mt-3 text-sm text-slate-700"><strong>Certificate Code:</strong> {result.certificate.certificateCode}</p>
                <p className="mt-2 break-all text-sm text-slate-700"><strong>Verify URL:</strong> {result.certificate.verifyUrl}</p>
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}
