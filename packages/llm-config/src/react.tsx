import React, { useState, useEffect } from 'react';
import type { LLMConfigStorage, LLMConfig, ApiFormat } from './index';

interface Props {
  storage: LLMConfigStorage;
  fetchModels?: (params: { baseURL: string; apiKey: string; apiFormat: string }) => Promise<{ data: { id: string }[] }>;
  onSaved?: () => void;
}

const emptyConfig = (): LLMConfig => ({ baseURL: '', apiKey: '', model: 'gpt-4o-mini', apiFormat: 'openai' });

export const LLMSettingsForm: React.FC<Props> = ({ storage, fetchModels: propFetchModels, onSaved }) => {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [editingIdx, setEditingIdx] = useState(0);
  const [models, setModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    storage.getAll().then(cs => setConfigs(cs.length > 0 ? cs : [emptyConfig()]));
  }, [storage]);

  const cfg = configs[editingIdx] || emptyConfig();

  const update = (patch: Partial<LLMConfig>) => {
    setConfigs(prev => prev.map((c, i) => i === editingIdx ? { ...c, ...patch } : c));
  };

  const handleAdd = () => {
    setConfigs(prev => [...prev, emptyConfig()]);
    setEditingIdx(configs.length);
  };

  const handleRemove = (idx: number) => {
    if (configs.length <= 1) return;
    setConfigs(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx >= idx) setEditingIdx(Math.max(0, editingIdx - 1));
  };

  const handleSave = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      await storage.saveAll(configs);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
      onSaved?.();
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleFetchModels = async () => {
    if (!cfg.baseURL || !cfg.apiKey) {
      setFetchError('Please fill in Base URL and API Key first');
      return;
    }
    setFetching(true);
    setFetchError('');
    try {
      if (propFetchModels) {
        const data = await propFetchModels({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, apiFormat: cfg.apiFormat });
        const ids: string[] = (data.data || []).map(m => m.id).sort();
        if (ids.length === 0) throw new Error('No models returned');
        setModels(ids);
      } else {
        const url = cfg.baseURL.replace(/\/+$/, '') + '/models';
        const headers: Record<string, string> = {};
        if (cfg.apiFormat === 'openai') {
          headers['Authorization'] = `Bearer ${cfg.apiKey}`;
        } else {
          headers['x-api-key'] = cfg.apiKey;
          headers['anthropic-version'] = '2023-06-01';
        }
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        const ids: string[] = (data.data || []).map((m: { id: string }) => m.id).sort();
        if (ids.length === 0) throw new Error('No models returned');
        setModels(ids);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="llm-settings">
      {/* Config tabs */}
      <div className="llm-tabs">
        {configs.map((c, i) => (
          <button
            key={i}
            className={`btn small ${i === editingIdx ? 'active' : ''}`}
            onClick={() => { setEditingIdx(i); setModels([]); }}
          >
            {c.baseURL ? new URL(c.baseURL).hostname : `Config ${i + 1}`}
            {configs.length > 1 && (
              <span className="llm-tab-remove" onClick={e => { e.stopPropagation(); handleRemove(i); }}>×</span>
            )}
          </button>
        ))}
        <button className="btn small" onClick={handleAdd}>+ Add</button>
      </div>

      {/* Editable fields */}
      <label>
        <span>API Format</span>
        <select
          className="select-input"
          value={cfg.apiFormat}
          onChange={e => { update({ apiFormat: e.target.value as ApiFormat }); setModels([]); }}
        >
          <option value="openai">OpenAI Compatible</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>

      <label>
        <span>API Base URL</span>
        <input
          type="text"
          value={cfg.baseURL}
          onChange={e => update({ baseURL: e.target.value })}
          placeholder={cfg.apiFormat === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'}
        />
      </label>

      <label>
        <span>API Key</span>
        <input
          type="password"
          value={cfg.apiKey}
          onChange={e => update({ apiKey: e.target.value })}
          placeholder={cfg.apiFormat === 'openai' ? 'sk-...' : 'sk-ant-...'}
        />
      </label>

      <label>
        <span>Model</span>
        <div className="model-row">
          {models.length > 0 ? (
            <select
              className="select-input"
              value={cfg.model}
              onChange={e => update({ model: e.target.value })}
            >
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={cfg.model}
              onChange={e => update({ model: e.target.value })}
              placeholder="gpt-4o-mini"
            />
          )}
          <button
            className="btn small"
            onClick={handleFetchModels}
            disabled={fetching}
          >
            {fetching ? '...' : 'Fetch'}
          </button>
        </div>
        {fetchError && <span className="llm-status error">{fetchError}</span>}
      </label>

      <button
        className="btn primary"
        onClick={handleSave}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Saving...' : 'Save'}
      </button>

      {status === 'saved' && <span className="llm-status success">Saved</span>}
      {status === 'error' && <span className="llm-status error">{errorMsg}</span>}
    </div>
  );
};
