import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateCards } from './llm-generate';
import { cardPresets } from './preset-loader';
import type { GeneratedCard } from './llm-generate';
import type { LLMConfig } from '@sour/llm-config';

export interface AiTask {
  id: string;
  status: 'running' | 'done' | 'error' | 'imported';
  presetLabel: string;
  question: string;
  cards: GeneratedCard[];
  importedIndices: number[];
  error: string;
  deck: string;
  category: string;
  tags: string[];
}

interface TaskState {
  tasks: AiTask[];
  enqueue: (config: LLMConfig, presetIdx: number, card: { question: string; answer: string; deck: string; category: string; tags: string[] }, opts?: { customPrompt?: string; categories?: string[] }) => void;
  dismiss: (id: string) => void;
  addCards: (id: string) => Promise<void>;
  addCard: (id: string, index: number) => Promise<void>;
}

let nextId = Date.now();

export const useTaskQueue = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],

      enqueue: async (config, presetIdx, card, opts) => {
        const id = String(++nextId);
        const isCustom = presetIdx === -1;
        const existingCategories = opts?.categories ?? [];
        const preset = isCustom
          ? { key: 'custom', label: 'Custom', system: '你是一个知识卡片生成助手。根据用户指令生成多张卡片。严格按照JSON格式返回。', prompt: (opts?.customPrompt ?? '') + '\n\n原始问题：{question}\n原始答案：{answer}\n\nJSON格式：{"cards":[{"question":"问题","answer":"答案","category":"分类"}]}' }
          : cardPresets[presetIdx];
        const task: AiTask = {
          id,
          status: 'running',
          presetLabel: preset.label,
          question: card.question.slice(0, 60) + (card.question.length > 60 ? '…' : ''),
          cards: [],
          importedIndices: [],
          error: '',
          deck: card.deck,
          category: card.category,
          tags: card.tags,
        };
        set(s => ({ tasks: [...s.tasks, task] }));

        try {
          const cards = await generateCards(config, preset, card, existingCategories);
          set(s => ({
            tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'done', cards } : t),
          }));
        } catch (e) {
          set(s => ({
            tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'error', error: e instanceof Error ? e.message : 'Failed' } : t),
          }));
        }
      },

      dismiss: (id) => {
        set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }));
      },

      addCards: async (id) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task || task.cards.length === 0) return;
        const unimported = task.cards.filter((_, i) => !task.importedIndices.includes(i));
        if (unimported.length === 0) return;
        const input = unimported.map(c => ({
          question: c.question,
          answer: c.answer,
          tags: Array.isArray(task.tags) ? task.tags : [],
          category: c.category || task.category,
        }));
        const deck = task.deck || 'Default';
        const { importCards } = (await import('../store-instance')).useStore.getState();
        await importCards(deck, '', input);
        const allIndices = task.cards.map((_, i) => i);
        set(s => ({
          tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'imported' as const, importedIndices: allIndices } : t),
        }));
      },

      addCard: async (id, index) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task || index < 0 || index >= task.cards.length) return;
        if (task.importedIndices.includes(index)) return;
        const c = task.cards[index];
        const input = [{
          question: c.question,
          answer: c.answer,
          tags: Array.isArray(task.tags) ? task.tags : [],
          category: c.category || task.category,
        }];
        const deck = task.deck || 'Default';
        const { importCards } = (await import('../store-instance')).useStore.getState();
        await importCards(deck, '', input);
        const importedIndices = [...task.importedIndices, index];
        const allImported = importedIndices.length === task.cards.length;
        set(s => ({
          tasks: s.tasks.map(t =>
            t.id === id
              ? { ...t, importedIndices, status: allImported ? ('imported' as const) : t.status }
              : t
          ),
        }));
      },
    }),
    {
      name: 'ai-tasks',
      partialize: (state) => ({
        tasks: state.tasks.map(t =>
          t.status === 'running' ? { ...t, status: 'error' as const, error: 'Refreshed while running' } : t
        ),
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<TaskState> | undefined;
        if (!p?.tasks) return current;
        return {
          ...current,
          tasks: p.tasks.map(t => ({
            ...t,
            importedIndices: t.importedIndices ?? [],
          } as AiTask)),
        };
      },
    }
  )
);
