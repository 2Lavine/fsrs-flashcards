import type { CardInput } from './types';

export interface ICardMutation {
  addCards(deckName: string, source: string, cards: CardInput[]): number;
  updateCardFSRS(card: { id: string; fsrs: { due: Date; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review?: Date; learning_steps: number } }): void;
  insertReviewLog(card: { id: string }, rating: number, result: { card: { due: Date; stability: number; difficulty: number; state: number }; log: { elapsed_days: number; last_elapsed_days: number; scheduled_days: number; learning_steps: number; review: Date } }): void;
  deleteCard(cardId: string): void;
  deleteCardsByDeck(deckName: string): number;
  togglePauseCategory(category: string): void;
  undoReview(cardId: string, previousFSRS: { due: Date; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review?: Date; learning_steps: number }): void;
}
