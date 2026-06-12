import { createLocalStorageStorage, migrateLegacy } from '@sour/llm-config/local-storage';

// Migrate legacy single-config to new multi-config format
const legacy = migrateLegacy('llm_config');
if (legacy.length > 0) {
  localStorage.setItem('llm_configs', JSON.stringify(legacy));
}

export const llmStorage = createLocalStorageStorage('llm_configs');
