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

export interface CardInput {
  question: string;
  answer: string;
  tags: string[];
  category?: string;
}

export interface DeckCards {
  deck: string;
  source: string;
  cards: CardInput[];
}
