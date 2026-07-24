const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'naita.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Thrown for any non-2xx response. `details` carries per-field messages. */
export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details ?? [];
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const token = tokenStore.get();

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    throw new ApiError(
      payload?.error?.message ?? 'Something went wrong.',
      response.status,
      payload?.error?.details
    );
  }

  return payload;
}

/**
 * Downloads a binary response (the result-sheet PDF). A plain `<a href>` can't
 * carry the Authorization header, so this fetches the file as a blob and
 * triggers the save from JS instead.
 */
export async function downloadFile(path) {
  const token = tokenStore.get();
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload?.error?.message ?? 'Could not download the file.', response.status);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? 'download';

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/me', { method: 'PATCH', body }),
  changePassword: (body) => request('/auth/me/password', { method: 'PATCH', body }),

  listUsers: (query = '') => request(`/users${query}`),
  listExaminers: () => request('/users/examiners'),
  createUser: (body) => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body }),
  resetUserPassword: (id, newPassword) => request(`/users/${id}/password`, { method: 'PATCH', body: { newPassword } }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  listApprentices: (query = '') => request(`/apprentices${query}`),
  createApprentice: (body) => request('/apprentices', { method: 'POST', body }),
  updateApprentice: (id, body) => request(`/apprentices/${id}`, { method: 'PATCH', body }),

  listSessions: (query = '') => request(`/sessions${query}`),
  getSession: (id) => request(`/sessions/${id}`),
  createSession: (body) => request('/sessions', { method: 'POST', body }),
  updateSession: (id, body) => request(`/sessions/${id}`, { method: 'PATCH', body }),
  cancelSession: (id) => request(`/sessions/${id}`, { method: 'DELETE' }),
  startSession: (id) => request(`/sessions/${id}/start`, { method: 'POST' }),
  getTimer: (id, signal) => request(`/sessions/${id}/timer`, { signal }),

  getMyEvaluation: (sessionId) => request(`/sessions/${sessionId}/my-evaluation`),
  saveMyEvaluation: (sessionId, body) => request(`/sessions/${sessionId}/my-evaluation`, { method: 'PUT', body }),
  submitMyEvaluation: (sessionId) => request(`/sessions/${sessionId}/my-evaluation/submit`, { method: 'POST' }),

  getSessionResults: (sessionId) => request(`/sessions/${sessionId}/results`),
  downloadResultSheet: (sessionId) => downloadFile(`/sessions/${sessionId}/result-sheet.pdf`),
  listResults: (query = '') => request(`/evaluations/results${query}`),
  reopenEvaluation: (id, reason) => request(`/evaluations/${id}/reopen`, { method: 'POST', body: { reason } }),
  listAudit: () => request('/evaluations/audit'),
};
