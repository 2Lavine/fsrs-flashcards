import { describe, it, expect } from 'vitest';
import { preview, review, getParameters } from '../services/SchedulerService';
import type { Flashcard } from '@fsrs/shared';
import { Rating } from 'ts-fsrs';
import type { RecordLogItem } from 'ts-fsrs';

function makeCard(overrides?: Partial<Flashcard['fsrs']>): Flashcard {
  return {
    id: 'test-1',
    deckId: '',
    deck: 'Default',
    question: 'Q?',
    answer: 'A.',
    tags: [],
    category: '',
    createdAt: new Date().toISOString(),
    fsrs: {
      due: new Date(),
      stability: 3,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      learning_steps: 0,
      ...overrides,
    },
  };
}

describe('SchedulerService', () => {
  describe('preview', () => {
    it('returns a record with 4 rating entries', () => {
      const card = makeCard();
      const result = preview(card);
      expect(result).toHaveProperty('1');
      expect(result).toHaveProperty('2');
      expect(result).toHaveProperty('3');
      expect(result).toHaveProperty('4');
    });

    it('each rating entry has card with due date', () => {
      const card = makeCard();
      const result = preview(card);
      for (const key of ['1', '2', '3', '4']) {
        const entry = result[key as unknown as keyof typeof result] as RecordLogItem;
        expect(entry.card.due).toBeInstanceOf(Date);
      }
    });

    it('works with learning card', () => {
      const card = makeCard({ state: 1, reps: 2, difficulty: 7 });
      const result = preview(card);
      expect(result).toHaveProperty('1');
      expect(result).toHaveProperty('2');
      expect(result).toHaveProperty('3');
      expect(result).toHaveProperty('4');
    });
  });

  describe('review', () => {
    it('mutates card state for Again rating', () => {
      const card = makeCard();
      const result = review(card, Rating.Again as any);
      expect(result.card.state).toBeDefined();
      expect(result.log).toBeDefined();
    });

    it('updates card due date after review', () => {
      const card = makeCard();
      const beforeDue = new Date(card.fsrs.due);
      const result = review(card, Rating.Good as any);
      expect(result.card.due.getTime()).toBeGreaterThanOrEqual(beforeDue.getTime());
    });
  });

  describe('getParameters', () => {
    it('returns FSRSParameters object', () => {
      const params = getParameters();
      expect(typeof params.request_retention).toBe('number');
      expect(params.request_retention).toBeGreaterThan(0);
      expect(params.request_retention).toBeLessThan(1);
    });
  });
});
