import React from 'react';
import { LLMSettingsForm } from '@sour/llm-config/react';
import { llmStorage } from '../services/llm-storage';
import { api } from '../db';

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold italic">LLM Settings</h2>
      <LLMSettingsForm
        storage={llmStorage}
        fetchModels={(params) => api.fetchModels(params)}
      />
    </div>
  );
};
