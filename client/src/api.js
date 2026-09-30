const TOKEN_KEY = 'casinworks_ops_token';
const ROLE_KEY = 'casinworks_ops_role';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('deskline_token');
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('deskline_token');
}

export function getStoredRole() {
  return localStorage.getItem(ROLE_KEY);
}

export function setStoredRole(role) {
  if (role) localStorage.setItem(ROLE_KEY, role);
}

export function clearStoredRole() {
  localStorage.removeItem(ROLE_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (data?.error && typeof data.error === 'string' && !data.error.includes('<!DOCTYPE')) {
      message = data.error;
    } else if (res.status === 404) {
      message = 'API route not found. Restart the server (cd server && npm run dev) and refresh.';
    } else if (res.status === 401) {
      message = 'Session expired. Please log in again.';
      clearToken();
      clearStoredRole();
    } else if (res.status === 403) {
      message = data?.error || 'You do not have access to this area.';
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  login: (password) =>
    request('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/api/logout', { method: 'POST' }),
  me: () => request('/api/me'),
  listOps: () => request('/api/ops'),

  listTickets: () => request('/api/ops/service-desk/tickets'),
  createTicket: (body) =>
    request('/api/ops/service-desk/tickets', { method: 'POST', body: JSON.stringify(body) }),
  updateTicket: (id, body) =>
    request(`/api/ops/service-desk/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getTicketStats: () => request('/api/ops/service-desk/stats'),

  listProjects: async () => {
    const data = await request('/api/ops/project-manager/projects');
    return Array.isArray(data) ? data : data.items || [];
  },
  listProjectsMeta: () => request('/api/ops/project-manager/projects'),
  createProject: (body) =>
    request('/api/ops/project-manager/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id, body) =>
    request(`/api/ops/project-manager/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getProjectStats: () => request('/api/ops/project-manager/stats'),

  listLeads: async () => {
    const data = await request('/api/ops/leads/leads');
    return Array.isArray(data) ? data : data.items || [];
  },
  listLeadsMeta: () => request('/api/ops/leads/leads'),
  createLead: (body) =>
    request('/api/ops/leads/leads', { method: 'POST', body: JSON.stringify(body) }),
  updateLead: (id, body) =>
    request(`/api/ops/leads/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getLeadStats: () => request('/api/ops/leads/stats'),

  getFinanceDashboard: (includeOffBooks = true) =>
    request(`/api/ops/finance/dashboard?includeOffBooks=${includeOffBooks ? 'true' : 'false'}`),
  listFinanceBilling: () => request('/api/ops/finance/billing'),
  listFinancePayments: () => request('/api/ops/finance/payments'),
  listFinanceExpenses: () => request('/api/ops/finance/expenses'),
  listFinanceAssets: () => request('/api/ops/finance/assets'),
  listFinanceCash: () => request('/api/ops/finance/cash'),
  getFinanceSettings: () => request('/api/ops/finance/settings'),
  getFinanceJournal: () => request('/api/ops/finance/journal'),
  getFinanceNotes: () => request('/api/ops/finance/notes'),
  getFinanceToyotaMemo: () => request('/api/ops/finance/toyota-memo'),

  getStats: () => request('/api/ops/service-desk/stats'),
};
