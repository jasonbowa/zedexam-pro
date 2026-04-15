const USER_KEY = 'zedexam_user';
const LEGACY_KEYS = ['user', 'adminUser', 'studentUser', 'student'];
const TOKEN_KEYS = ['adminToken', 'token'];

function parseMaybe(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getStoredUser() {
  const modern = parseMaybe(localStorage.getItem(USER_KEY));
  if (modern) return modern;

  for (const key of LEGACY_KEYS) {
    const legacy = parseMaybe(localStorage.getItem(key));
    if (legacy) {
      const normalized = normalizeUser(legacy);
      localStorage.setItem(USER_KEY, JSON.stringify(normalized));
      return normalized;
    }
  }

  return null;
}

export function normalizeUser(user = {}) {
  return {
    id: user.id ?? null,
    name: user.name || user.fullName || 'User',
    email: user.email || '',
    phone: user.phone || user.phoneNumber || '',
    grade: user.grade || user.form || '',
    role: user.role || (user.isAdmin ? 'admin' : 'student'),
    token: user.token || localStorage.getItem('zedexam_token') || localStorage.getItem('adminToken') || null,
    isAdmin: user.role === 'admin' || user.isAdmin === true,
  };
}

export function isAdminUser(user = getStoredUser()) {
  return !!user && (user.role === 'admin' || user.isAdmin === true);
}

export function saveUser(user) {
  const normalized = normalizeUser(user);
  localStorage.setItem(USER_KEY, JSON.stringify(normalized));
  if (normalized.token) localStorage.setItem('zedexam_token', normalized.token);

  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }

  localStorage.setItem('user', JSON.stringify(normalized));
  if (isAdminUser(normalized)) {
    localStorage.setItem('adminUser', JSON.stringify(normalized));
    localStorage.removeItem('studentUser');
    localStorage.removeItem('student');
  } else {
    localStorage.setItem('studentUser', JSON.stringify(normalized));
    localStorage.setItem('student', JSON.stringify(normalized));
    localStorage.removeItem('adminUser');
  }
}

export function clearStoredUsers() {
  [USER_KEY, 'zedexam_token', ...LEGACY_KEYS, ...TOKEN_KEYS].forEach((key) => localStorage.removeItem(key));
}

export function getAuthToken() {
  return getStoredUser()?.token || localStorage.getItem('zedexam_token') || localStorage.getItem('adminToken') || null;
}

export function getDefaultRouteForUser(user = getStoredUser()) {
  if (!user) return '/login';
  return isAdminUser(user) ? '/admin' : '/dashboard';
}
