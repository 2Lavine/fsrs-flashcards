import { fsrs, generatorParameters, type Grade, type RecordLogItem, type FSRSParameters } from 'ts-fsrs';
import type { Flashcard } from './types';

const params = generatorParameters({});
const scheduler = fsrs(params);

export function preview(card: Flashcard) {
  return scheduler.repeat(card.fsrs, new Date());
}

export function review(card: Flashcard, rating: Grade): RecordLogItem {
  return scheduler.next(card.fsrs, new Date(), rating);
}

export function getParameters(): FSRSParameters {
  return params;
}
