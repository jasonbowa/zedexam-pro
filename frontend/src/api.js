import {
  clearStoredUsers,
  getAuthToken,
  getStoredUser as getStoredUserFromLib,
  saveUser,
} from "./lib/auth";

const resolveApiBase = () => {
  const envBase = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  const envRoot = String(import.meta.env.VITE_API_URL || "").trim();
  const raw = envBase || envRoot;

  if (!raw) {
    return "https://zedexam.onrender.com/api";
  }

  const cleaned = raw.replace(/\/+$/, "");
  return cleaned.endsWith("/api") ? cleaned : `${cleaned}/api`;
};

export const API_BASE = resolveApiBase();
export const API_ROOT = API_BASE.replace(/\/api$/, "");

const buildUrl = (endpoint = "") => {
  if (!endpoint) return API_BASE;
  return endpoint.startsWith("/") ? `${API_BASE}${endpoint}` : `${API_BASE}/${endpoint}`;
};

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

const normalizeAuthPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return { token: "", user: null, raw: payload };
  }

  const token =
    payload.token ||
    payload.accessToken ||
    payload.jwt ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    "";

  const user =
    payload.user ||
    payload.student ||
    payload.admin ||
    payload?.data?.user ||
    payload?.data?.student ||
    payload?.data?.admin ||
    null;

  return { token, user, raw: payload };
};

export const getToken = () => {
  return (
    getAuthToken() ||
    localStorage.getItem("zedexam_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("studentToken") ||
    localStorage.getItem("authToken") ||
    ""
  );
};

export const getStoredUser = () => {
  const fromLib = getStoredUserFromLib?.();
  if (fromLib) return fromLib;

  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("studentUser") ||
      localStorage.getItem("student") ||
      localStorage.getItem("zedexam_user");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveAuth = (payload = {}) => {
  const { token, user } = normalizeAuthPayload(payload);

  const mergedUser = user
    ? {
        ...user,
        token: token || user?.token || null,
      }
    : token
    ? { token }
    : null;

  if (token) {
    localStorage.setItem("token", token);
    localStorage.setItem("zedexam_token", token);
    localStorage.setItem("studentToken", token);
    localStorage.setItem("authToken", token);
  }

  if (mergedUser) {
    saveUser(mergedUser);
    localStorage.setItem("user", JSON.stringify(mergedUser));
    localStorage.setItem("studentUser", JSON.stringify(mergedUser));
    localStorage.setItem("student", JSON.stringify(mergedUser));
    localStorage.setItem("zedexam_user", JSON.stringify(mergedUser));
  }

  return { token, user: mergedUser };
};

export const clearAuth = () => {
  clearStoredUsers?.();
  localStorage.removeItem("token");
  localStorage.removeItem("zedexam_token");
  localStorage.removeItem("studentToken");
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  localStorage.removeItem("studentUser");
  localStorage.removeItem("student");
  localStorage.removeItem("zedexam_user");
};

export const isTokenExpired = (token) => {
  try {
    if (!token) return true;

    const parts = String(token).split(".");
    const encodedPayload = parts.length >= 2 ? parts[1] : null;
    if (!encodedPayload) return false;

    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const payload = JSON.parse(atob(normalized + padding));

    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
};

const parseResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!text) return null;

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
};

const getErrorMessage = (data) => {
  const details =
    typeof data === "object" && Array.isArray(data?.errors) && data.errors.length
      ? `: ${data.errors.join("; ")}`
      : "";

  if (typeof data === "object" && data?.message) {
    return `${data.message}${details}`;
  }

  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  return `Something went wrong${details}`;
};

const request = async (endpoint, options = {}, { requiresAuth = false } = {}) => {
  const token = getToken();

  if (requiresAuth && token && isTokenExpired(token)) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  const headers = {
    ...(options.headers || {}),
  };

  const isFormData = options.body instanceof FormData;

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (requiresAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(endpoint), {
    ...options,
    headers,
  });

  if (response.status === 401 && requiresAuth) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data));
  }

  return normalizeTopicShape(data);
};

export const authFetch = async (endpoint, options = {}) => {
  return request(endpoint, options, { requiresAuth: true });
};

export const publicFetch = async (endpoint, options = {}) => {
  return request(endpoint, options, { requiresAuth: false });
};

export const studentRegister = async (payload) => {
  const data = await publicFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data;
};

export const studentLogin = async (payload) => {
  const data = await publicFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data;
};

export const adminLogin = async (payload) => {
  const data = await publicFetch("/admin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data;
};

export default API_BASE;