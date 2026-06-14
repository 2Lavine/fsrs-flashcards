import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GeneratedCard } from '../services/llm-generate';

// Mock generateCards
const mockGenerateCards = vi.fn();
const mockGenerateCardsWithRaw = vi.fn();
vi.mock('../services/llm-generate', () => ({
  generateCards: mockGenerateCards,
  generateCardsWithRaw: mockGenerateCardsWithRaw,
}));

function mockOk(cards: GeneratedCard[], text = '') {
  return mockGenerateCardsWithRaw.mockResolvedValueOnce({ text, cards });
}
function mockFail(err: Error) {
  return mockGenerateCardsWithRaw.mockRejectedValueOnce(err);
}

// Mock preset-loader
vi.mock('../services/preset-loader', () => ({
  cardPresets: [
    { key: 'context', label: '解释脉络', system: 'sys1', prompt: 'prompt1' },
    { key: 'terms', label: '解释名词', system: 'sys2', prompt: 'prompt2' },
  ],
}));

// Mock dynamic import for store-instance
const mockImportCards = vi.fn();
vi.mock('../store-instance', () => ({
  useStore: {
    getState: () => ({
      importCards: mockImportCards,
    }),
  },
}));

describe('task-queue', () => {
  beforeEach(() => {
    // Clear localStorage between tests
    localStorage.clear();
    vi.clearAllMocks();
    // Reset the module to get fresh zustand store state
    vi.resetModules();
  });

  function makeCards(count: number): GeneratedCard[] {
    return Array.from({ length: count }, (_, i) => ({
      question: `Q${i + 1}`,
      answer: `A${i + 1}`,
      category: `C${i + 1}`,
    }));
  }

  const mockConfig = {
    baseURL: 'https://api.example.com',
    apiKey: 'sk-test',
    model: 'test-model',
    apiFormat: 'openai' as const,
  };

  const mockCard = {
    question: 'What is X?',
    answer: 'X is Y.',
    deck: 'Default',
    category: 'test',
    tags: ['tag1'],
  };

  it('enqueue creates a running task', async () => {
    mockOk(makeCards(2));
    const { useTaskQueue } = await import('../services/task-queue');

    await new Promise<void>(resolve => {
      useTaskQueue.getState().enqueue(mockConfig, 0, mockCard);
      // Wait for async enqueue
      setTimeout(resolve, 50);
    });

    const state = useTaskQueue.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].status).toBe('done');
    expect(state.tasks[0].cards).toHaveLength(2);
  });

  it('enqueue with custom prompt (presetIdx -1) works', async () => {
    mockOk(makeCards(1));
    const { useTaskQueue } = await import('../services/task-queue');

    await new Promise<void>(resolve => {
      useTaskQueue.getState().enqueue(mockConfig, -1, mockCard, {
        customPrompt: 'Custom prompt',
        categories: ['existing'],
      });
      setTimeout(resolve, 50);
    });

    const state = useTaskQueue.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].status).toBe('done');
    expect(state.tasks[0].presetLabel).toBe('Custom');
  });

  it('sets task to error when generateCards throws', async () => {
    mockFail(new Error('API Error'));
    const { useTaskQueue } = await import('../services/task-queue');

    await new Promise<void>(resolve => {
      useTaskQueue.getState().enqueue(mockConfig, 0, mockCard);
      setTimeout(resolve, 50);
    });

    const state = useTaskQueue.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].status).toBe('error');
    expect(state.tasks[0].error).toBe('API Error');
  });

  it('dismiss removes task from list', async () => {
    mockOk(makeCards(2));
    const { useTaskQueue } = await import('../services/task-queue');

    await new Promise<void>(resolve => {
      useTaskQueue.getState().enqueue(mockConfig, 0, mockCard);
      setTimeout(resolve, 50);
    });

    const taskId = useTaskQueue.getState().tasks[0].id;
    useTaskQueue.getState().dismiss(taskId);

    expect(useTaskQueue.getState().tasks).toHaveLength(0);
  });

  it('addCards imports cards and marks task as imported (state kept for persistence)', async () => {
    mockOk(makeCards(3));
    mockImportCards.mockResolvedValueOnce(undefined);
    const { useTaskQueue } = await import('../services/task-queue');

    await new Promise<void>(resolve => {
      useTaskQueue.getState().enqueue(mockConfig, 0, mockCard);
      setTimeout(resolve, 50);
    });

    const taskId = useTaskQueue.getState().tasks[0].id;
    await useTaskQueue.getState().addCards(taskId);

    expect(mockImportCards).toHaveBeenCalledWith('Default', '', [
      { question: 'Q1', answer: 'A1', tags: ['tag1'], category: 'C1' },
      { question: 'Q2', answer: 'A2', tags: ['tag1'], category: 'C2' },
      { question: 'Q3', answer: 'A3', tags: ['tag1'], category: 'C3' },
    ]);
    // Task stays in state (AiTaskPanel filters 'imported' for UI; persistence
    // also needs the entry in localStorage so undo/import history survives)
    const tasks = useTaskQueue.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('imported');
    expect(tasks[0].importedIndices).toEqual([0, 1, 2]);
  });

  it('addCards does nothing if task not found', async () => {
    const { useTaskQueue } = await import('../services/task-queue');
    await useTaskQueue.getState().addCards('nonexistent');
    expect(mockImportCards).not.toHaveBeenCalled();
  });

  it('enqueue truncates long questions in task display', async () => {
    mockOk(makeCards(1));
    const { useTaskQueue } = await import('../services/task-queue');
    const longQ = 'A'.repeat(200);

    await new Promise<void>(resolve => {
      useTaskQueue.getState().enqueue(mockConfig, 0, {
        ...mockCard,
        question: longQ,
      });
      setTimeout(resolve, 50);
    });

    const task = useTaskQueue.getState().tasks[0];
    expect(task.question.length).toBe(60 + 1); // 60 + ellipsis
    expect(task.question.endsWith('…')).toBe(true);
  });
});
