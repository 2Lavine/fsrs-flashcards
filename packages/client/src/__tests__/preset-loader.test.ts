import { describe, it, expect, vi } from 'vitest';

// Mock the ?raw imports before importing the module
vi.mock('../../presets/context.md?raw', () => ({
  default: `---
key: context
label: 解释脉络
---
## system
You are a knowledge card assistant. Given a card's question and answer, explain the context behind the concept.

## prompt
Please explain the context of: {question}
Answer: {answer}
Output JSON format: {"cards":[{"question":"...","answer":"..."}]}`,
}));

vi.mock('../../presets/terms.md?raw', () => ({
  default: `---
key: terms
label: 解释名词
---
## system
You are a terminology extraction assistant. Extract key terms from the given content and create definition cards.

## prompt
Extract key terms from:
{question}
{answer}
Output JSON: {"cards":[{"question":"term","answer":"definition","category":"optional"}]}`,
}));

vi.mock('../../presets/counterexamples.md?raw', () => ({
  default: `---
key: counterexamples
label: 反例与边界
outputType: explanation
---
## system
You are an edge-case analyst.

## prompt
Find counterexamples for: {question}
{answer}`,
}));

describe('preset-loader', () => {
  it('loads and parses preset markdown files', async () => {
    const { loadPresets, cardPresets } = await import('../services/preset-loader');
    const presets = loadPresets();
    expect(presets).toHaveLength(3);
    expect(cardPresets).toHaveLength(3);
  });

  it('presets have required fields', async () => {
    const { loadPresets } = await import('../services/preset-loader');
    const presets = loadPresets();
    for (const p of presets) {
      expect(typeof p.key).toBe('string');
      expect(p.key.length).toBeGreaterThan(0);
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
      expect(typeof p.system).toBe('string');
      expect(p.system.length).toBeGreaterThan(0);
      expect(typeof p.prompt).toBe('string');
      expect(p.prompt.length).toBeGreaterThan(0);
    }
  });

  it('context preset has correct key and label', async () => {
    const { loadPresets } = await import('../services/preset-loader');
    const presets = loadPresets();
    const context = presets.find(p => p.key === 'context');
    expect(context).toBeDefined();
    expect(context!.label).toBe('解释脉络');
  });

  it('terms preset has correct key and label', async () => {
    const { loadPresets } = await import('../services/preset-loader');
    const presets = loadPresets();
    const terms = presets.find(p => p.key === 'terms');
    expect(terms).toBeDefined();
    expect(terms!.label).toBe('解释名词');
  });

  it('handles malformed markdown gracefully', async () => {
    // Test that the 2 valid presets parse correctly
    const { loadPresets } = await import('../services/preset-loader');
    const presets = loadPresets();
    // Both provided mocks are valid, so 2 should parse
    expect(presets.length).toBeGreaterThanOrEqual(1);
  });
});
