import { api } from '../db';
import type { Flashcard, Deck, ICardQuery, ReviewEntry } from '@fsrs/shared';

function rowToCard(r: Record<string, unknown>): Flashcard {
  return {
    id: r['id'] as string, deckId: r['deck_id'] as string, deck: (r['deck_name'] || '') as string,
    question: r['question'] as string, answer: r['answer'] as string,
    tags: JSON.parse((r['tags'] as string) || '[]'), category: (r['category'] as string) || '',
    createdAt: r['created_at'] as string,
    fsrs: {
      due: new Date(r['fsrs_due'] as string), stability: r['fsrs_stability'] as number,
      difficulty: r['fsrs_difficulty'] as number, elapsed_days: r['fsrs_elapsed_days'] as number,
      scheduled_days: r['fsrs_scheduled_days'] as number, reps: r['fsrs_reps'] as number,
      lapses: r['fsrs_lapses'] as number, state: r['fsrs_state'] as number,
      last_review: r['fsrs_last_review'] ? new Date(r['fsrs_last_review'] as string) : undefined,
      learning_steps: r['fsrs_learning_steps'] as number,
    },
  };
}

export class CardQuery implements ICardQuery {
  async getCategories() { return (await api.categories()).categories; }
  async getAllCards(_filter?: string, _params?: (string | number)[]) { return (await api.cards()).cards.map(rowToCard); }
  async getDueCards(category?: string, excludePaused?: string[], deckId?: string) { return (await api.dueCards({ category, deckId, paused: excludePaused })).cards.map(rowToCard); }
  async getDecks() { return (await api.decks()).decks as Deck[]; }
  async getStats() { return api.stats(); }
  async getStreak() { return (await api.streak()).streak; }
  async getDailyCounts() { return (await api.dailyCounts()).daily; }
  async getCategoryCounts() { return (await api.categoryCounts()).categories; }
  async getRatingCounts() { return (await api.ratingCounts()).ratings; }
  async getPausedCategories() { return (await api.paused()).paused; }
  async getCategoriesByDeck(deckId?: string) { return (await api.categories(deckId)).categories; }
  async getRecentLogs(): Promise<ReviewEntry[]> { return (await api.recentLogs()).logs.map((v: Record<string, unknown>) => ({
    id: v['id'] as number, cardId: v['card_id'] as string, rating: v['rating'] as number,
    state: v['state'] as number, due: new Date(v['due'] as string), stability: v['stability'] as number,
    difficulty: v['difficulty'] as number, elapsedDays: v['elapsed_days'] as number,
    scheduledDays: v['scheduled_days'] as number, review: new Date(v['review'] as string),
    question: (v['question'] as string) || '(deleted card)',
  })); }
  async getCategoryTree() {
    const cats = await this.getCategoryCounts();
    const roots: { name: string; count: number; children: { name: string; fullPath: string; count: number }[] }[] = [];
    for (const c of cats) {
      const sep = c.name.indexOf('::');
      if (sep === -1) roots.push({ name: c.name, count: c.count, children: [] });
      else {
        const rn = c.name.slice(0, sep);
        let rt = roots.find(x => x.name === rn);
        if (!rt) { rt = { name: rn, count: 0, children: [] }; roots.push(rt); }
        rt.children.push({ name: c.name.slice(sep + 2), fullPath: c.name, count: c.count });
      }
    }
    return roots;
  }
}
