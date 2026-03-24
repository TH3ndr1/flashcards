// lib/utils/storyHash.ts
import { createHash } from 'crypto';

/**
 * Computes a short deterministic hash of card content.
 * Used to detect when a deck's cards have changed since a story was generated.
 */
export function computeCardsHash(cards: { question: string; answer: string }[]): string {
  const sorted = [...cards].sort((a, b) => a.question.localeCompare(b.question));
  const content = sorted.map(c => `${c.question}|${c.answer}`).join('\n');
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
