const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

let accessToken = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token) => { accessToken = token; },
  clear: () => { accessToken = null; },
};

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

async function rawRequest(path, { method = 'GET', body, signal } = {}) {
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
}

async function parseOrThrow(response) {
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? 'Something went wrong.', response.status, payload?.error?.details);
  }
  return payload;
}

async function performRefresh() {
  const run = async () => {
    const response = await rawRequest('/auth/refresh', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      accessToken = null;
      return null;
    }
    accessToken = payload.token;
    return payload;
  };

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('naita-refresh', run);
  }
  if (!performRefresh._inFlight) {
    performRefresh._inFlight = run().finally(() => { performRefresh._inFlight = null; });
  }
  return performRefresh._inFlight;
}

const NO_RETRY_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

export async function request(path, options = {}) {
  let response = await rawRequest(path, options);

  if (response.status === 401 && !NO_RETRY_PATHS.has(path)) {
    const refreshed = await performRefresh();
    if (refreshed) response = await rawRequest(path, options);
  }

  try {
    return await parseOrThrow(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) onUnauthorized();
    throw error;
  }
}

export async function downloadFile(path) {
  let response = await rawRequest(path);

  if (response.status === 401) {
    const refreshed = await performRefresh();
    if (refreshed) response = await rawRequest(path);
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
  refresh: async () => {
    const result = await performRefresh();
    if (!result) throw new ApiError('Sign in to continue.', 401);
    return result;
  },
  logout: () => request('/auth/logout', { method: 'POST' }).finally(() => { accessToken = null; }),
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