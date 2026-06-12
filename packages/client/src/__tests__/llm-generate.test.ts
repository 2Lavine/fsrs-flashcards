import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMConfig } from '@sour/llm-config';
import type { CardPreset, GeneratedCard } from '../services/llm-generate';

// Mock fetch globally
beforeEach(() => {
  vi.restoreAllMocks();
});

// We test parseGeneratedCards indirectly through generateCards with mocked fetch
// since parseGeneratedCards is not exported

async function generateCards(
  config: LLMConfig,
  preset: CardPreset,
  card: { question: string; answer: string },
  existingCategories: string[] = [],
): Promise<GeneratedCard[]> {
  // Re-import dynamically to get the actual implementation
  const mod = await import('../services/llm-generate');
  return mod.generateCards(config, preset, card, existingCategories);
}

describe('generateCards', () => {
  const mockConfig: LLMConfig = {
    baseURL: 'https://api.example.com',
    apiKey: 'sk-test',
    model: 'test-model',
    apiFormat: 'openai',
  };

  const mockPreset: CardPreset = {
    key: 'test',
    label: 'Test',
    system: 'You are a test assistant.',
    prompt: 'Generate cards for: {question} / {answer}{categories}',
  };

  const mockCard = { question: 'What is X?', answer: 'X is Y.' };

  it('calls fetch with correct request body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: '{"cards":[{"question":"Q","answer":"A"}]}' }),
    } as Response);

    await generateCards(mockConfig, mockPreset, mockCard);

    expect(fetch).toHaveBeenCalledWith('/api/llm/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('test-model'),
    });

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.baseURL).toBe('https://api.example.com');
    expect(body.model).toBe('test-model');
    expect(body.prompt).toContain('What is X?');
    expect(body.prompt).toContain('X is Y.');
  });

  it('parses valid JSON response with code fence', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: '```json\n{"cards":[{"question":"Q1","answer":"A1","category":"C1"}]}\n```' }),
    } as Response);

    const result = await generateCards(mockConfig, mockPreset, mockCard);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('Q1');
    expect(result[0].answer).toBe('A1');
    expect(result[0].category).toBe('C1');
  });

  it('parses valid JSON response without code fence', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: '{"cards":[{"question":"Q","answer":"A"}]}' }),
    } as Response);

    const result = await generateCards(mockConfig, mockPreset, mockCard);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe('Q');
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'Server error' }),
    } as Response);

    await expect(generateCards(mockConfig, mockPreset, mockCard)).rejects.toThrow('Server error');
  });

  it('throws on invalid JSON in response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: 'not json at all' }),
    } as Response);

    await expect(generateCards(mockConfig, mockPreset, mockCard)).rejects.toThrow('No JSON found');
  });

  it('validates cards have required fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: '{"cards":[{"question":"","answer":""}]}' }),
    } as Response);

    await expect(generateCards(mockConfig, mockPreset, mockCard)).rejects.toThrow('validation failed');
  });

  it('throws on empty cards array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: '{"cards":[]}' }),
    } as Response);

    await expect(generateCards(mockConfig, mockPreset, mockCard)).rejects.toThrow();
  });

  it('appends existing categories to prompt', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ text: '{"cards":[{"question":"Q","answer":"A"}]}' }),
    } as Response);

    await generateCards(mockConfig, mockPreset, mockCard, ['cat1', 'cat2']);

    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.prompt).toContain('cat1、cat2');
  });
});
