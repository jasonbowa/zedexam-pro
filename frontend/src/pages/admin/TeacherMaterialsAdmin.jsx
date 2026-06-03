import { useEffect, useState } from 'react';
import PageShell from '../../components/PageShell';
import PaymentInstructions from '../../components/PaymentInstructions';
import { authFetch } from '../../api';
import { EmptyState, LoadingState, Notice, SectionCard } from '../../components/ui';
import { FormInput, FormSelect, FormTextarea, PrimaryButton } from '../../components/forms';

const blankMaterial = {
  title: '',
  materialType: 'NOTE',
  subject: '',
  grade: '',
  topic: '',
  summary: '',
  learningObjectives: '',
  keyConcepts: '',
  suggestedTeachingMethod: '',
  commonLearnerDifficulties: '',
  assessmentQuestions: '',
  markingGuide: '',
  downloadUrl: '',
  status: 'ACTIVE',
  qualityStatus: 'DRAFT',
};

export default function TeacherMaterialsAdmin() {
  const [users, setUsers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [materialForm, setMaterialForm] = useState(blankMaterial);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [userData, materialData] = await Promise.all([
        authFetch('/admin/teacher-material-users'),
        authFetch('/admin/teacher-materials'),
      ]);
      setUsers(Array.isArray(userData) ? userData : []);
      setMaterials(Array.isArray(materialData) ? materialData : []);
    } catch (err) {
      setError(err.message || 'Failed to load Teacher Materials admin workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const activateUser = async (id) => {
    setError('');
    setMessage('');
    try {
      await authFetch(`/admin/teacher-material-users/${id}/activate`, { method: 'PATCH', body: JSON.stringify({}) });
      setMessage('Teacher Materials access activated.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to activate Teacher Materials access.');
    }
  };

  const deactivateUser = async (id) => {
    setError('');
    setMessage('');
    try {
      await authFetch(`/admin/teacher-material-users/${id}/deactivate`, { method: 'PATCH', body: JSON.stringify({}) });
      setMessage('Teacher Materials access deactivated.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to deactivate Teacher Materials access.');
    }
  };

  const resetTeacherPassword = async (user) => {
    const nextPassword = window.prompt(`Enter a new password for ${user.name}:`);
    if (!nextPassword) return;
    setError('');
    setMessage('');
    try {
      await authFetch(`/admin/teacher-material-users/${user.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: nextPassword }),
      });
      setMessage('Teacher Materials password reset successfully.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to reset Teacher Materials password.');
    }
  };

  const publishActiveTeacherMaterials = async () => {
    if (!window.confirm('Publish all active Teacher Materials that are still Draft, Needs Review, or Approved?')) return;
    setError('');
    setMessage('');
    try {
      const data = await authFetch('/admin/teacher-materials/publish-active-existing', { method: 'POST', body: JSON.stringify({}) });
      setMessage(data.message || 'Active Teacher Materials published.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to publish active Teacher Materials.');
    }
  };

  const updateMaterialField = (key, value) => setMaterialForm((prev) => ({ ...prev, [key]: value }));

  const resetMaterialForm = () => {
    setMaterialForm(blankMaterial);
    setEditingMaterialId(null);
  };

  const saveMaterial = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await authFetch(editingMaterialId ? `/admin/teacher-materials/${editingMaterialId}` : '/admin/teacher-materials', {
        method: editingMaterialId ? 'PATCH' : 'POST',
        body: JSON.stringify(materialForm),
      });
      setMessage(editingMaterialId ? 'Teacher material updated.' : 'Teacher material created.');
      resetMaterialForm();
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to save teacher material.');
    } finally {
      setSaving(false);
    }
  };

  const editMaterial = (item) => {
    setEditingMaterialId(item.id);
    setMaterialForm({
      title: item.title || '',
      materialType: item.materialType || 'NOTE',
      subject: item.subject || '',
      grade: item.grade || '',
      topic: item.topic || '',
      summary: item.summary || '',
      learningObjectives: item.learningObjectives || '',
      keyConcepts: item.keyConcepts || '',
      suggestedTeachingMethod: item.suggestedTeachingMethod || '',
      commonLearnerDifficulties: item.commonLearnerDifficulties || '',
      assessmentQuestions: item.assessmentQuestions || '',
      markingGuide: item.markingGuide || '',
      downloadUrl: item.downloadUrl || '',
      status: item.status || 'ACTIVE',
      qualityStatus: item.qualityStatus || 'DRAFT',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm('Delete this teacher material?')) return;
    setError('');
    setMessage('');
    try {
      await authFetch(`/admin/teacher-materials/${id}`, { method: 'DELETE' });
      setMessage('Teacher material deleted.');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete teacher material.');
    }
  };

  return (
    <PageShell title="Teacher Materials Admin" subtitle="Activate teacher-only access and publish structured teaching materials.">
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <PaymentInstructions status="Manual confirmation" packageName="Teacher Materials" />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Teacher Materials Users" subtitle="Activate access after confirming mobile money payment proof.">
          {loading ? <LoadingState text="Loading teacher users..." /> : null}
          {!loading && users.length === 0 ? (
            <EmptyState title="No teacher accounts yet" text="Teachers who register for materials will appear here for activation." />
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{user.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{user.phone || user.phoneNumber} / {user.email || 'No email'} / {user.package || 'No package selected'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {user.status || 'PENDING'}
                        </span>
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          Proof: {user.proofStatus || 'PENDING'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Reference: {user.paymentReference || 'Awaiting WhatsApp proof'} / Amount: {user.amountPaid ? `K${Number(user.amountPaid).toFixed(2)}` : 'Not recorded'}</p>
                      <p className="mt-1 text-xs text-slate-500">Expires: {user.expiresAt ? new Date(user.expiresAt).toLocaleDateString() : 'Not activated yet'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-success" onClick={() => activateUser(user.id)}>Activate</button>
                      <button className="btn btn-danger" onClick={() => deactivateUser(user.id)}>Deactivate</button>
                      <button className="btn btn-secondary" onClick={() => resetTeacherPassword(user)}>Reset Password</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={editingMaterialId ? 'Edit Material' : 'Create Material'} subtitle="Keep teacher content structured, credible, and easy to filter.">
          <form className="grid gap-4" onSubmit={saveMaterial}>
            <FormInput label="Title" value={materialForm.title} onChange={(event) => updateMaterialField('title', event.target.value)} placeholder="e.g. Photosynthesis lesson support" />
            <div className="grid gap-4 md:grid-cols-4">
              <FormSelect label="Material Type" value={materialForm.materialType} onChange={(event) => updateMaterialField('materialType', event.target.value)}>
                <option value="NOTE">Teacher Note</option>
                <option value="GUIDE">Teacher Guide</option>
                <option value="DOWNLOAD">Download</option>
              </FormSelect>
              <FormSelect label="Status" value={materialForm.status} onChange={(event) => updateMaterialField('status', event.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="INACTIVE">Inactive</option>
              </FormSelect>
              <FormSelect label="Quality Status" value={materialForm.qualityStatus} onChange={(event) => updateMaterialField('qualityStatus', event.target.value)}>
                <option value="DRAFT">Draft</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="APPROVED">Approved</option>
                <option value="PUBLISHED">Published</option>
              </FormSelect>
              <FormInput label="Grade/Form" value={materialForm.grade} onChange={(event) => updateMaterialField('grade', event.target.value)} placeholder="Form 3 / Grade 12" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="Subject" value={materialForm.subject} onChange={(event) => updateMaterialField('subject', event.target.value)} />
              <FormInput label="Topic" value={materialForm.topic} onChange={(event) => updateMaterialField('topic', event.target.value)} />
            </div>
            <FormTextarea label="Overview / Clear Explanation" value={materialForm.summary} onChange={(event) => updateMaterialField('summary', event.target.value)} />
            <FormTextarea label="Learning Objectives" value={materialForm.learningObjectives} onChange={(event) => updateMaterialField('learningObjectives', event.target.value)} />
            <FormTextarea label="Key Concepts" value={materialForm.keyConcepts} onChange={(event) => updateMaterialField('keyConcepts', event.target.value)} />
            <FormTextarea label="Suggested Teaching Method" value={materialForm.suggestedTeachingMethod} onChange={(event) => updateMaterialField('suggestedTeachingMethod', event.target.value)} />
            <FormTextarea label="Common Learner Difficulties" value={materialForm.commonLearnerDifficulties} onChange={(event) => updateMaterialField('commonLearnerDifficulties', event.target.value)} />
            <FormTextarea label="Assessment Questions" value={materialForm.assessmentQuestions} onChange={(event) => updateMaterialField('assessmentQuestions', event.target.value)} />
            <FormTextarea label="Answers / Marking Guide" value={materialForm.markingGuide} onChange={(event) => updateMaterialField('markingGuide', event.target.value)} />
            <FormInput label="Download URL" value={materialForm.downloadUrl} onChange={(event) => updateMaterialField('downloadUrl', event.target.value)} placeholder="https://... or /uploads/file.pdf" />
            <div className="flex flex-wrap gap-3">
              <PrimaryButton disabled={saving}>{saving ? 'Saving...' : editingMaterialId ? 'Update Material' : 'Create Material'}</PrimaryButton>
              {editingMaterialId ? <button type="button" className="btn btn-secondary" onClick={resetMaterialForm}>Cancel</button> : null}
            </div>
          </form>
        </SectionCard>
      </div>

      <SectionCard
        title="Published Teacher Materials"
        subtitle="Use exam-style or syllabus-expectation language unless a source proves official past-paper status."
        action={<button className="btn btn-secondary" onClick={publishActiveTeacherMaterials}>Publish Active Existing</button>}
      >
        {loading ? <LoadingState text="Loading material library..." /> : null}
        {!loading && materials.length === 0 ? (
          <EmptyState title="No teacher materials yet" text="Create notes, guides, and download records for active teachers." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {materials.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="badge badge-info">{item.materialType}</span>
                      <span className={item.qualityStatus === 'PUBLISHED' ? 'badge badge-success' : 'badge badge-warning'}>{item.qualityStatus || 'DRAFT'}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{[item.subject, item.grade, item.topic].filter(Boolean).join(' / ') || 'General material'}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary || item.keyConcepts || 'No overview added yet.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-secondary" onClick={() => editMaterial(item)}>Edit</button>
                    <button className="btn border border-red-200 bg-red-50 text-red-700" onClick={() => deleteMaterial(item.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
