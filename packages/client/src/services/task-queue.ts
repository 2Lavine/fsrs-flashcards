import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateCards } from './llm-generate';
import { cardPresets } from './preset-loader';
import type { GeneratedCard } from './llm-generate';
import type { LLMConfig } from '@sour/llm-config';

export interface AiTask {
  id: string;
  status: 'running' | 'done' | 'error';
  presetLabel: string;
  question: string;
  cards: GeneratedCard[];
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
        const input = task.cards.map(c => ({
          question: c.question,
          answer: c.answer,
          tags: Array.isArray(task.tags) ? task.tags : [],
          category: c.category || task.category,
        }));
        const deck = task.deck || 'Default';
        const { importCards } = (await import('../store-instance')).useStore.getState();
        await importCards(deck, '', input);
        set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }));
      },
    }),
    {
      name: 'ai-tasks',
      partialize: (state) => ({
        tasks: state.tasks.map(t =>
          t.status === 'running' ? { ...t, status: 'error' as const, error: 'Refreshed while running' } : t
        ),
      }),
    }
  )
);
