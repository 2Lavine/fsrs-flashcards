const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path}: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`PUT ${path}: ${res.status}`);
  return res.json();
}

export const api = {
  health: () => get<{ ok: boolean }>('/health'),
  dueCards: (params?: { category?: string; deckId?: string; paused?: string[] }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set('category', params.category);
    if (params?.deckId) sp.set('deckId', params.deckId);
    if (params?.paused?.length) sp.set('paused', params.paused.join(','));
    const qs = sp.toString();
    return get<{ cards: Record<string, unknown>[] }>(`/due-cards${qs ? '?' + qs : ''}`);
  },
  cards: (params?: { search?: string; deckId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.deckId) sp.set('deckId', params.deckId);
    const qs = sp.toString();
    return get<{ cards: Record<string, unknown>[] }>(`/cards${qs ? '?' + qs : ''}`);
  },
  stats: () => get<{ total: number; due: number; new: number; learning: number; review: number; totalReviews: number; today: number; avgDifficulty: string }>('/stats'),
  streak: () => get<{ streak: number }>('/streak'),
  dailyCounts: (days?: number) => {
    const sp = new URLSearchParams();
    if (days) sp.set('days', String(days));
    const qs = sp.toString();
    return get<{ daily: { label: string; date: string; count: number }[] }>(`/daily-counts${qs ? '?' + qs : ''}`);
  },
  decks: () => get<{ decks: { id: string; name: string; source: string }[] }>('/decks'),
  deckCounts: () => get<{ decks: { name: string; cardCount: number; reviewCount: number }[] }>('/deck-counts'),
  categories: (deckId?: string) => get<{ categories: string[] }>(`/categories${deckId ? '?deckId=' + deckId : ''}`),
  categoryCounts: () => get<{ categories: { name: string; count: number }[] }>('/category-counts'),
  paused: () => get<{ paused: string[] }>('/paused'),
  togglePause: (cat: string) => post<{ ok: boolean }>(`/paused/${encodeURIComponent(cat)}`),
  review: (body: { cardId: string; rating: number; fsrs: Record<string, unknown>; log: Record<string, unknown> }) => post<{ ok: boolean }>('/review', body),
  undo: (body: { cardId: string; prevFSRS: Record<string, unknown> }) => post<{ ok: boolean }>('/undo', body),
  deleteCard: (id: string) => del<{ ok: boolean }>(`/cards/${id}`),
  deleteDeck: (name: string) => del<{ ok: boolean }>(`/decks/${encodeURIComponent(name)}`),
  importCards: (body: { deck: string; source?: string; cards: { question: string; answer: string; tags?: string[]; category?: string }[] }) => post<{ ok: boolean; deck: string; imported: number }>('/import', body),
  recentLogs: () => get<{ logs: Record<string, unknown>[] }>('/recent-logs'),
  ratingCounts: () => get<{ ratings: { label: string; count: number }[] }>('/rating-counts'),
  updateCard: (id: string, data: { question: string; answer: string }) => put<{ ok: boolean }>(`/cards/${id}`, data),
  fetchModels: (params: { baseURL: string; apiKey: string; apiFormat: string }) => post<{ data: { id: string }[] }>('/llm/fetch-models', params),
};
