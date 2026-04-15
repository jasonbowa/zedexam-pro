import axios from 'axios';
import { getAuthToken } from './auth';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const API = `${API_BASE_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toDisplayError(error))
);

export function toDisplayError(error) {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Request failed. Please try again.';

  const wrapped = new Error(message);
  wrapped.original = error;
  wrapped.status = error?.response?.status;
  wrapped.data = error?.response?.data;
  return wrapped;
}

export async function firstSuccessfulRequest(requestFactories = []) {
  let lastError = null;

  for (const factory of requestFactories) {
    try {
      const response = await factory();
      return response;
    } catch (error) {
      lastError = toDisplayError(error);
    }
  }

  throw lastError || new Error('No endpoint succeeded.');
}

export async function getTopicsBySubject(subjectId) {
  const routes = [
    () => api.get(`/subjects/${subjectId}/topics`),
    () => api.get(`/topics/subject/${subjectId}`),
    () => api.get(`/topics`, { params: { subjectId } }),
    async () => {
      const response = await api.get('/topics');
      const rows = Array.isArray(response.data) ? response.data : [];
      return { ...response, data: rows.filter((row) => Number(row.subjectId) === Number(subjectId)) };
    },
  ];

  const response = await firstSuccessfulRequest(routes);
  return Array.isArray(response.data) ? response.data : [];
}

export async function getAllSubjects() {
  const response = await api.get('/subjects');
  return Array.isArray(response.data) ? response.data : [];
}

export async function getAllTopics() {
  const response = await firstSuccessfulRequest([
    () => api.get('/topics'),
    async () => {
      const subjects = await getAllSubjects();
      const grouped = await Promise.all(
        subjects.map(async (subject) => {
          const items = await getTopicsBySubject(subject.id);
          return items;
        })
      );
      return { data: grouped.flat() };
    },
  ]);

  return Array.isArray(response.data) ? response.data : [];
}

export async function getDashboardStats() {
  const [subjects, topics, results, mockExams] = await Promise.allSettled([
    getAllSubjects(),
    getAllTopics(),
    api.get('/results'),
    api.get('/mock-exams'),
  ]);

  return {
    subjects: subjects.status === 'fulfilled' ? subjects.value.length : 0,
    topics: topics.status === 'fulfilled' ? topics.value.length : 0,
    attempts:
      results.status === 'fulfilled' && Array.isArray(results.value.data) ? results.value.data.length : 0,
    mockExams:
      mockExams.status === 'fulfilled' && Array.isArray(mockExams.value.data) ? mockExams.value.data.length : 0,
  };
}
