import type { Flashcard, Deck, ReviewEntry } from './types';

export interface ICardQuery {
  getCategories(): string[];
  getAllCards(filterSQL?: string, params?: (string | number)[]): Flashcard[];
  getDueCards(category?: string, excludePausedCategories?: string[], deckId?: string): Flashcard[];
  getDecks(): Deck[];
  getStats(): {
    total: number;
    due: number;
    new: number;
    learning: number;
    review: number;
    totalReviews: number;
    today: number;
    avgDifficulty: string;
  };
  getStreak(): number;
  getRecentLogs(limit?: number): ReviewEntry[];
  getDeckStats(): { name: string; count: number }[];
  getDailyCounts(days?: number): { label: string; count: number }[];
  getCategoryCounts(): { name: string; count: number }[];
  getRatingCounts(): { label: string; count: number }[];
  getPausedCategories(): string[];
  getTodayProgress(): { due: number; reviewed: number };
  getCategoryTree(): { name: string; count: number; children: { name: string; fullPath: string; count: number }[] }[];
}
