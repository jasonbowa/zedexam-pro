const crypto = require('crypto');

function buildCertificateCode({ resultId, studentId, secret }) {
  const raw = `${resultId}:${studentId}:${secret}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16).toUpperCase();
}

function buildCertificatePayload({ result, secret, baseUrl }) {
  const code = buildCertificateCode({
    resultId: result.id,
    studentId: result.studentId,
    secret,
  });

  return {
    certificateCode: code,
    verifyUrl: `${String(baseUrl || '').replace(/\/$/, '')}/api/results/${result.id}/verify?code=${code}`,
  };
}

module.exports = {
  buildCertificateCode,
  buildCertificatePayload,
};
