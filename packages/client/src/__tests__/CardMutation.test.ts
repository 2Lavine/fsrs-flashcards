import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('CardMutation API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function importModule() {
    const { CardMutation } = await import('../services/CardMutation');
    return new CardMutation();
  }

  it('deleteCard calls DELETE /cards/:id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    const cm = await importModule();
    await cm.deleteCard('card-1');

    expect(mockFetch).toHaveBeenCalledWith('/api/cards/card-1', { method: 'DELETE' });
  });

  it('deleteCardsByDeck calls DELETE /decks/:name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    const cm = await importModule();
    await cm.deleteCardsByDeck('Test');

    expect(mockFetch).toHaveBeenCalledWith('/api/decks/Test', { method: 'DELETE' });
  });

  it('deleteCardsByDeck throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response);

    const cm = await importModule();
    await expect(cm.deleteCardsByDeck('Missing')).rejects.toThrow('DELETE /decks/Missing: 404');
  });

  it('addCards calls POST /import', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, deck: 'Test', imported: 3 }),
    } as Response);

    const cm = await importModule();
    const count = await cm.addCards('Test', 'source', [
      { question: 'Q1', answer: 'A1', tags: ['t1'], category: 'c1' },
      { question: 'Q2', answer: 'A2', tags: [], category: '' },
    ]);

    expect(count).toBe(3);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.deck).toBe('Test');
    expect(body.cards).toHaveLength(2);
  });

  it('recordReview calls POST /review with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    const cm = await importModule();
    const reviewDate = new Date('2026-06-12T10:00:00Z');
    await cm.recordReview('card-1', {
      due: new Date('2026-06-20T10:00:00Z'),
      stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 0,
      reps: 1, lapses: 0, state: 2, learning_steps: 0,
    } as any, 3, {
      elapsed_days: 0, last_elapsed_days: 0, scheduled_days: 0,
      learning_steps: 0, review: reviewDate,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.cardId).toBe('card-1');
    expect(body.rating).toBe(3);
    expect(body.log.review).toBe('2026-06-12T10:00:00.000Z');
  });

  it('undoReview calls POST /undo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    const cm = await importModule();
    await cm.undoReview('card-1', {
      due: new Date('2026-06-15T10:00:00Z'),
      stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 0,
      reps: 0, lapses: 0, state: 0, learning_steps: 0,
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/undo', expect.objectContaining({
      method: 'POST',
    }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.cardId).toBe('card-1');
  });

  it('togglePauseCategory calls POST /paused/:cat', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    const cm = await importModule();
    await cm.togglePauseCategory('test-cat');

    expect(mockFetch).toHaveBeenCalledWith('/api/paused/test-cat', expect.objectContaining({
      method: 'POST',
    }));
  });
});
