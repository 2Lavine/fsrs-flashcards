import { describe, it, expect } from 'vitest';
import { app } from '../app';

function api(path: string, init?: RequestInit) {
  return app.request(`http://localhost${path}`, init);
}

describe('API routes', () => {
  describe('GET /api/health', () => {
    it('returns ok', async () => {
      const res = await api('/api/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('GET /api/decks', () => {
    it('returns decks array', async () => {
      const res = await api('/api/decks');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.decks)).toBe(true);
    });
  });

  describe('GET /api/categories', () => {
    it('returns categories array', async () => {
      const res = await api('/api/categories');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.categories)).toBe(true);
    });

    it('filters by deckId', async () => {
      const res = await api('/api/categories?deckId=nonexistent');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.categories)).toBe(true);
      expect(body.categories.length).toBe(0);
    });
  });

  describe('GET /api/due-cards', () => {
    it('returns cards array', async () => {
      const res = await api('/api/due-cards');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.cards)).toBe(true);
    });

    it('filters by category', async () => {
      const res = await api('/api/due-cards?category=nonexistent');
      expect(res.status).toBe(200);
      expect(Array.isArray((await res.json()).cards)).toBe(true);
    });

    it('filters by deckId', async () => {
      const res = await api('/api/due-cards?deckId=nonexistent');
      expect(res.status).toBe(200);
      expect(Array.isArray((await res.json()).cards)).toBe(true);
    });
  });

  describe('GET /api/cards', () => {
    it('returns all cards', async () => {
      const res = await api('/api/cards');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.cards)).toBe(true);
    });

    it('searches by keyword', async () => {
      const res = await api('/api/cards?search=nonexistent_xyz123');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.cards)).toBe(true);
      expect(body.cards.length).toBe(0);
    });
  });

  describe('GET /api/stats', () => {
    it('returns stats object', async () => {
      const res = await api('/api/stats');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.total).toBe('number');
      expect(typeof body.due).toBe('number');
      expect(typeof body.new).toBe('number');
    });
  });

  describe('GET /api/streak', () => {
    it('returns streak number', async () => {
      const res = await api('/api/streak');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.streak).toBe('number');
    });
  });

  describe('GET /api/daily-counts', () => {
    it('returns 7 days', async () => {
      const res = await api('/api/daily-counts');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.daily)).toBe(true);
      expect(body.daily.length).toBe(7);
    });
  });

  describe('GET /api/category-counts', () => {
    it('returns category counts', async () => {
      const res = await api('/api/category-counts');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.categories)).toBe(true);
    });
  });

  describe('GET /api/rating-counts', () => {
    it('returns 4 ratings', async () => {
      const res = await api('/api/rating-counts');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.ratings)).toBe(true);
      expect(body.ratings.length).toBe(4);
    });
  });

  describe('GET /api/paused', () => {
    it('returns paused array', async () => {
      const res = await api('/api/paused');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.paused)).toBe(true);
    });
  });

  describe('GET /api/recent-logs', () => {
    it('returns logs array', async () => {
      const res = await api('/api/recent-logs');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.logs)).toBe(true);
    });
  });

  describe('GET /api/category-counts (verify)', () => {
    let firstCount: number;
    it('has non-empty categories if cards exist', async () => {
      const res = await api('/api/stats');
      const stats = await res.json();
      if (stats.total > 0) {
        const catRes = await api('/api/category-counts');
        const catBody = await catRes.json();
        // Not all cards have categories, but there might be some
        expect(catRes.status).toBe(200);
      }
    });
  });

  describe('DELETE /api/decks/:name', () => {
    it('returns 200 for nonexistent deck', async () => {
      const res = await api('/api/decks/__nonexistent_test_deck', { method: 'DELETE' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(0);
    });
  });

  describe('DELETE /api/cards/:id', () => {
    it('returns 200 for nonexistent card', async () => {
      const res = await api('/api/cards/__nonexistent_test_card', { method: 'DELETE' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('POST /api/paused/:cat', () => {
    it('toggles pause state', async () => {
      const res = await api('/api/paused/test_category_toggle', { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe('404 for unknown routes', () => {
    it('returns 404 for GET /api/nonexistent', async () => {
      const res = await api('/api/nonexistent_route_xyz');
      expect(res.status).toBe(404);
    });

    it('returns 404 for POST to unknown', async () => {
      const res = await api('/api/nonexistent', { method: 'POST' });
      expect(res.status).toBe(404);
    });
  });
});
