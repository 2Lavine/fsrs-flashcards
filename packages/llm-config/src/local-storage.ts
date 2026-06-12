import type { LLMConfig, LLMConfigStorage } from './index';

const defaultKey = 'llm_configs';

export function createLocalStorageStorage(key = defaultKey): LLMConfigStorage {
  return {
    getAll: async () => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    },
    saveAll: async (configs) => {
      localStorage.setItem(key, JSON.stringify(configs));
    },
  };
}

export function migrateLegacy(key = 'llm_config'): LLMConfig[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const config = JSON.parse(raw);
    if (config && typeof config.baseURL === 'string') {
      localStorage.removeItem(key);
      return [config as LLMConfig];
    }
  } catch {}
  return [];
}
