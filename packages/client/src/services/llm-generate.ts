import type { LLMConfig } from '@sour/llm-config';

export interface CardPreset {
  key: string;
  label: string;
  system: string;
  prompt: string;
}

export const cardPresets: CardPreset[] = [
  {
    key: '脉络',
    label: '深入解释脉络',
    system: '你是一个深度学习的助手，擅长帮学习者理清知识脉络和内在逻辑。回答简洁但有深度，不要超过200字。',
    prompt: '基于以下卡片的内容，深入解释这个话题的脉络和逻辑关系：\n\n问题：{question}\n答案：{answer}',
  },
  {
    key: '名词',
    label: '解释名词',
    system: '你是一个知识渊博的术语解释助手。对每个关键名词给出清晰简洁的定义。',
    prompt: '解释以下卡片中涉及的关键名词和概念：\n\n问题：{question}\n答案：{answer}\n\n列出每个重要的名词/概念，给出简短定义。',
  },
];

export async function generateCardRewrite(
  config: LLMConfig,
  preset: CardPreset,
  card: { question: string; answer: string },
): Promise<string> {
  const prompt = preset.prompt
    .replaceAll('{question}', card.question)
    .replaceAll('{answer}', card.answer);

  const res = await fetch('/api/llm/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      model: config.model,
      apiFormat: config.apiFormat,
      system: preset.system,
      prompt,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Generation failed');
  }

  const data = await res.json();
  return data.text;
}
