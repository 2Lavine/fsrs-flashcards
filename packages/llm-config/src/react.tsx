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

  const inputClasses =
    'flex h-10 w-full rounded-lg border bg-background px-4 py-2.5 text-sm font-mono placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring focus:border-transparent';

  const selectClasses =
    'flex h-10 w-full rounded-lg border bg-background px-4 py-2.5 pr-8 text-sm appearance-none outline-none focus:ring-2 focus:ring-ring focus:border-transparent';

  const tabClasses = (active: boolean) =>
    `px-3 py-1.5 text-xs rounded-md border transition-colors ${
      active
        ? 'bg-accent text-accent-foreground border-border'
        : 'bg-background text-muted-foreground border-transparent hover:text-foreground hover:border-border'
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* Config tabs */}
      <div className="flex flex-wrap gap-1">
        {configs.map((c, i) => (
          <button
            key={i}
            type="button"
            className={tabClasses(i === editingIdx)}
            onClick={() => { setEditingIdx(i); setModels([]); }}
          >
            {c.baseURL ? new URL(c.baseURL).hostname : `Config ${i + 1}`}
            {configs.length > 1 && (
              <span
                className="ml-1 opacity-40 hover:opacity-100 text-xs"
                onClick={e => { e.stopPropagation(); handleRemove(i); }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="px-3 py-1.5 text-xs rounded-md border border-transparent bg-background text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          onClick={handleAdd}
        >
          + Add
        </button>
      </div>

      {/* API Format */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">API Format</span>
        <select
          className={selectClasses}
          value={cfg.apiFormat}
          onChange={e => { update({ apiFormat: e.target.value as ApiFormat }); setModels([]); }}
        >
          <option value="openai">OpenAI Compatible</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>

      {/* Base URL */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">API Base URL</span>
        <input
          type="text"
          className={inputClasses}
          value={cfg.baseURL}
          onChange={e => update({ baseURL: e.target.value })}
          placeholder={cfg.apiFormat === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'}
        />
      </label>

      {/* API Key */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">API Key</span>
        <input
          type="password"
          className={inputClasses}
          value={cfg.apiKey}
          onChange={e => update({ apiKey: e.target.value })}
          placeholder={cfg.apiFormat === 'openai' ? 'sk-...' : 'sk-ant-...'}
        />
      </label>

      {/* Model */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Model</span>
        <div className="flex gap-2">
          {models.length > 0 ? (
            <select
              className={selectClasses + ' flex-1'}
              value={cfg.model}
              onChange={e => update({ model: e.target.value })}
            >
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input
              type="text"
              className={inputClasses + ' flex-1'}
              value={cfg.model}
              onChange={e => update({ model: e.target.value })}
              placeholder="gpt-4o-mini"
            />
          )}
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-md border bg-background text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
            onClick={handleFetchModels}
            disabled={fetching}
          >
            {fetching ? '...' : 'Fetch'}
          </button>
        </div>
        {fetchError && <span className="text-xs font-medium text-destructive">{fetchError}</span>}
      </label>

      {/* Save */}
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold px-6 py-2.5 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        onClick={handleSave}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Saving...' : 'Save'}
      </button>

      {status === 'saved' && <span className="text-xs font-medium text-emerald-600">Saved</span>}
      {status === 'error' && <span className="text-xs font-medium text-destructive">{errorMsg}</span>}
    </div>
  );
};
