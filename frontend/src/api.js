import { clearStoredUsers, getAuthToken, getStoredUser as getStoredUserFromLib, saveUser } from "./lib/auth";

const resolveApiRoot = () => {
  const raw = String(import.meta.env.VITE_API_URL || "").trim();
  if (!raw) return "";
  return raw.replace(/\/api\/?$/, "").replace(/\/+$/, "");
};

export const API_ROOT = resolveApiRoot();
export const API_BASE = API_ROOT ? `${API_ROOT}/api` : "/api";

const normalizeTopicShape = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeTopicShape);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, normalizeTopicShape(entry)])
  );

  const looksLikeTopic =
    (Object.prototype.hasOwnProperty.call(normalized, "subjectId") ||
      Object.prototype.hasOwnProperty.call(normalized, "subject")) &&
    Object.prototype.hasOwnProperty.call(normalized, "title");

  if (looksLikeTopic && !normalized.name) {
    normalized.name = normalized.title;
  }

  return normalized;
};

export const getToken = () => {
  return getAuthToken() || localStorage.getItem("token");
};

export const getStoredUser = () => {
  return getStoredUserFromLib();
};

export const saveAuth = ({ token, user }) => {
  const mergedUser = { ...(user || {}), token: token || user?.token || null };

  if (token) {
    localStorage.setItem("token", token);
    localStorage.setItem("zedexam_token", token);
  }

  if (user) {
    saveUser(mergedUser);
  }
};

export const clearAuth = () => {
  clearStoredUsers();
};

export const isTokenExpired = (token) => {
  try {
    if (!token) return true;

    const parts = String(token).split('.');
    const encodedPayload = parts.length >= 2 ? parts[1] : null;
    if (!encodedPayload) return false;

    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const payload = JSON.parse(atob(normalized + padding));

    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch (error) {
    return false;
  }
};

export const authFetch = async (endpoint, options = {}) => {
  const token = getToken();

  if (token && isTokenExpired(token)) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const details =
      typeof data === "object" && Array.isArray(data?.errors) && data.errors.length
        ? `: ${data.errors.join("; ")}`
        : "";
    const message =
      typeof data === "object" && data?.message
        ? `${data.message}${details}`
        : `Something went wrong${details}`;
    throw new Error(message);
  }

  return normalizeTopicShape(data);
};

export const publicFetch = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const details =
      typeof data === "object" && Array.isArray(data?.errors) && data.errors.length
        ? `: ${data.errors.join("; ")}`
        : "";
    const message =
      typeof data === "object" && data?.message
        ? `${data.message}${details}`
        : `Something went wrong${details}`;
    throw new Error(message);
  }

  return normalizeTopicShape(data);
};

export default API_BASE;
