import { z } from 'zod';
import type { LLMConfig } from '@sour/llm-config';

const GeneratedCardSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().optional(),
});

const GeneratedCardsSchema = z.object({
  cards: z.array(GeneratedCardSchema).min(1),
});

export interface GeneratedCard {
  question: string;
  answer: string;
  category?: string;
}

export interface CardPreset {
  key: string;
  label: string;
  system: string;
  prompt: string;
}

function parseGeneratedCards(text: string): GeneratedCard[] {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error('No JSON found in AI response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[1]);
  } catch {
    throw new Error('Invalid JSON from AI');
  }

  const result = GeneratedCardsSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`AI output validation failed: ${issues}`);
  }

  return result.data.cards;
}

export async function generateCards(
  config: LLMConfig,
  preset: CardPreset,
  card: { question: string; answer: string },
  existingCategories: string[] = [],
): Promise<GeneratedCard[]> {
  const result = await generateCardsWithRaw(config, preset, card, existingCategories);
  return result.cards;
}

export async function generateCardsFromText(
  config: LLMConfig,
  system: string,
  prompt: string,
): Promise<{ text: string; cards: GeneratedCard[] }> {
  const res = await fetch('/api/llm/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      model: config.model,
      apiFormat: config.apiFormat,
      system,
      prompt,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Generation failed');
  }

  const data = await res.json();
  try {
    const cards = parseGeneratedCards(data.text);
    return { text: data.text, cards };
  } catch {
    return { text: data.text, cards: [] };
  }
}

export async function generateCardsWithRaw(
  config: LLMConfig,
  preset: CardPreset,
  card: { question: string; answer: string },
  existingCategories: string[] = [],
): Promise<{ text: string; cards: GeneratedCard[] }> {
  const catsHint = existingCategories.length > 0
    ? `\n现有分类列表（优先使用已有分类）：${existingCategories.join('、')}`
    : '';
  const prompt = preset.prompt
    .replaceAll('{question}', card.question)
    .replaceAll('{answer}', card.answer)
    .replaceAll('{categories}', catsHint);

  return generateCardsFromText(config, preset.system, prompt);
}
