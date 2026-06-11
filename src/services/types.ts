import type { Card } from 'ts-fsrs';

export interface Flashcard {
  id: string;
  deckId: string;
  deck: string;
  question: string;
  answer: string;
  tags: string[];
  category: string;
  createdAt: string;
  fsrs: Card;
}

export interface Deck {
  id: string;
  name: string;
  source: string;
}

export interface ReviewEntry {
  id: number;
  cardId: string;
  rating: number;
  state: number;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  review: Date;
  question: string;
}

export type CardInput = { question: string; answer: string; tags: string[]; category?: string };

// ─── Interfaces ──────────────────────────

export interface ICardQuery {
  getCategories(): Promise<string[]>;
  getAllCards(filterSQL?: string, params?: (string | number)[]): Promise<Flashcard[]>;
  getDueCards(category?: string, excludePaused?: string[], deckId?: string): Promise<Flashcard[]>;
  getDecks(): Promise<Deck[]>;
  getStats(): Promise<{ total: number; due: number; new: number; learning: number; review: number; totalReviews: number; today: number; avgDifficulty: string }>;
  getStreak(): Promise<number>;
  getRecentLogs(limit?: number): Promise<ReviewEntry[]>;
  getDailyCounts(days?: number): Promise<{ label: string; count: number }[]>;
  getCategoryCounts(): Promise<{ name: string; count: number }[]>;
  getRatingCounts(): Promise<{ label: string; count: number }[]>;
  getPausedCategories(): Promise<string[]>;
  getCategoriesByDeck(deckId?: string): Promise<string[]>;
  getCategoryTree(): Promise<{ name: string; count: number; children: { name: string; fullPath: string; count: number }[] }[]>;
}

export interface ICardMutation {
  addCards(deckName: string, source: string, cards: CardInput[]): Promise<number>;
  updateCardFSRS(id: string, fsrs: Card): Promise<void>;
  insertReviewLog(cardId: string, rating: number, result: { card: Card; log: { elapsed_days: number; last_elapsed_days: number; scheduled_days: number; learning_steps: number; review: Date } }): Promise<void>;
  deleteCard(id: string): Promise<void>;
  deleteCardsByDeck(name: string): Promise<number>;
  undoReview(id: string, prevFSRS: { due: Date; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review?: Date; learning_steps: number }): Promise<void>;
  togglePauseCategory(category: string): Promise<void>;
}
