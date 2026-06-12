import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export type ApiFormat = 'openai' | 'anthropic';

export interface LLMConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  apiFormat: ApiFormat;
}

export interface LLMConfigStorage {
  getAll(): Promise<LLMConfig[]>;
  saveAll(configs: LLMConfig[]): Promise<void>;
}

export function createLLMProvider(config: LLMConfig) {
  if (config.apiFormat === 'anthropic') {
    return createAnthropic({
      baseURL: config.baseURL || undefined,
      apiKey: config.apiKey,
    });
  }
  return createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
}
