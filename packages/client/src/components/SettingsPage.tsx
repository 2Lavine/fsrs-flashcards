import React from 'react';
import { LLMSettingsForm } from '@sour/llm-config/react';
import { llmStorage } from '../services/llm-storage';
import { api } from '../db';

export const SettingsPage: React.FC = () => {
  return (
    <>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.1rem',
        fontWeight: 600,
        fontStyle: 'italic',
        color: 'var(--accent)',
        marginBottom: 8,
      }}>LLM Settings</h2>
      <LLMSettingsForm
        storage={llmStorage}
        fetchModels={(params) => api.fetchModels(params)}
      />
    </>
  );
};
