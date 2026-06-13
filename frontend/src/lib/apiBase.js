const DEFAULT_API_ROOT = "https://zedexam.onrender.com";

function sanitizeApiUrl(value) {
  return String(value || "")
    .replace(/\\[rnt]/gi, "")
    .replace(/[\r\n\t]/g, "")
    .trim();
}

export function resolveApiRoot({ apiBaseUrl, apiUrl } = {}) {
  const raw =
    sanitizeApiUrl(apiBaseUrl) ||
    sanitizeApiUrl(apiUrl) ||
    DEFAULT_API_ROOT;
  const cleaned = raw.replace(/\/+$/, "");

  return cleaned.endsWith("/api") ? cleaned.slice(0, -4) : cleaned;
}

export function resolveApiBase(environment = {}) {
  return `${resolveApiRoot(environment)}/api`;
}
