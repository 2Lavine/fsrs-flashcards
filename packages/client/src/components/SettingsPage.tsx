import { LLMSettingsForm } from "@sour/llm-config/react";
import React from "react";
import { api } from "../db";
import { llmStorage } from "../services/llm-storage";

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <h2 className="text-lg font-semibold italic">LLM Settings</h2>
      <LLMSettingsForm
        storage={llmStorage}
        fetchModels={(params) => api.fetchModels(params)}
      />
    </div>
  );
};
