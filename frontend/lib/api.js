'use client';
// Tiny API client + session helpers.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function authHeaders() {
  if (typeof window === 'undefined') return {};
  const t = localStorage.getItem('oc_token');
  return t ? { Authorization: 'Bearer ' + t } : {};
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(API_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const saveSession = (token, user) => {
  localStorage.setItem('oc_token', token);
  localStorage.setItem('oc_user', JSON.stringify(user));
};
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('oc_user'));
  } catch {
    return null;
  }
};
export const clearSession = () => {
  localStorage.removeItem('oc_token');
  localStorage.removeItem('oc_user');
};

export const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('oc_token') : null);
export const setToken = (token) => {
  if (typeof window !== 'undefined') localStorage.setItem('oc_token', token);
};
export const clearToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('oc_token');
    localStorage.removeItem('oc_user');
  }
};

// Status labels — same vocabulary as the Google Sheet
export const CALL_LABELS = {
  new: 'Nouveau',
  confirmed: 'Confirmé',
  call1: 'Appel 1',
  call2: 'Appel 2',
  call3: 'Appel 3',
  call_whatsapp: 'Appel + Message Whatsapp',
  call_sms: 'Appel + Message SMS',
  no_answer: 'Pas de réponse',
  postponed: 'Reporté',
  unreachable: 'Injoignable',
  voicemail: 'Boîte Vocal',
  cancelled: 'Annulé',
  not_serious: 'Pas sérieux',
  fake: 'Fake order',
  double: 'Double',
};

export const SHIP_LABELS = {
  pending: 'En attente',
  in_distribution: 'Mise En Distribution',
  delivered: 'Livré',
  refused: 'Refusé',
  returned: 'Retourné',
  unreachable: 'Injoignable',
  postponed: 'Reporté',
  no_answer: 'Pas de réponse',
  cancelled: 'Annulé',
};

export const dh = (n) =>
  `${Number(n || 0).toLocaleString('fr-MA', { maximumFractionDigits: 0 })} DH`;
export const pct = (n) => `${Number(n || 0).toFixed(1)}%`;
export const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
