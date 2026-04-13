const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

function ensureLogFile() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '', 'utf8');
}

function safeSlice(value, max = 200) {
  if (value === undefined || value === null) return null;
  return String(value).slice(0, max);
}

function appendAuditLog(event, payload = {}) {
  try {
    ensureLogFile();
    const row = {
      at: new Date().toISOString(),
      event,
      ...payload,
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(row) + '\n', 'utf8');
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
  }
}

function logAdminAction(req, event, details = {}) {
  appendAuditLog(event, {
    actorId: req.user?.id || null,
    actorRole: req.user?.role || null,
    ip: safeSlice(req.ip || req.connection?.remoteAddress || 'unknown', 80),
    method: req.method,
    path: req.originalUrl,
    details,
  });
}

function readAuditLog(limit = 200) {
  try {
    ensureLogFile();
    const lines = fs
      .readFileSync(LOG_FILE, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-Math.max(1, Math.min(Number(limit) || 200, 500)));

    return lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { at: null, event: 'parse_error', raw: line };
        }
      })
      .reverse();
  } catch (error) {
    console.error('Failed to read audit log:', error.message);
    return [];
  }
}

module.exports = {
  appendAuditLog,
  logAdminAction,
  readAuditLog,
};
