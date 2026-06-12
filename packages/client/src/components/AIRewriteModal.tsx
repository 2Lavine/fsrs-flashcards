import React, { useState } from 'react';
import type { Flashcard } from '@fsrs/shared';
import { llmStorage } from '../services/llm-storage';
import { cardPresets, generateCardRewrite } from '../services/llm-generate';
import type { CardPreset } from '../services/llm-generate';
import { api } from '../db';
import { useStore } from '../store-instance';

interface Props {
  card: Flashcard | null;
  visible: boolean;
  onClose: () => void;
}

export const AIRewriteModal: React.FC<Props> = ({ card, visible, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activePreset, setActivePreset] = useState<CardPreset | null>(null);

  const handleGenerate = async (preset: CardPreset) => {
    if (!card) return;
    const configs = await llmStorage.getAll();
    const config = configs[0];
    if (!config || !config.baseURL) {
      setErrorMsg('Please configure LLM settings first');
      setStatus('error');
      return;
    }
    setActivePreset(preset);
    setStatus('loading');
    setErrorMsg('');
    try {
      const text = await generateCardRewrite(config, preset, { question: card.question, answer: card.answer });
      setResult(text);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'AI generation failed');
      setStatus('error');
    }
  };

  const handleReplace = async () => {
    if (!card) return;
    await api.updateCard(card.id, { question: card.question, answer: card.answer + '\n\n' + result });
    useStore.getState().bump();
    reset();
    onClose();
  };

  const handleNewCard = async () => {
    if (!card) return;
    await useStore.getState().importCards(card.deck, '', [
      { question: card.question, answer: card.answer + '\n\n' + result, tags: card.tags, category: card.category }
    ]);
    reset();
    onClose();
  };

  const reset = () => {
    setStatus('idle');
    setResult('');
    setErrorMsg('');
    setActivePreset(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!visible) return null;

  return (
    <div className="modal-overlay active" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <h2>AI Rewrite{activePreset ? ` · ${activePreset.label}` : ''}</h2>

        {status === 'idle' && (
          <div className="ai-rewrite-presets">
            {cardPresets.map(p => (
              <button key={p.key} className="btn" onClick={() => handleGenerate(p)}>
                {p.label}
              </button>
            ))}
          </div>
        )}

        {status === 'loading' && (
          <div className="loading">
            <div className="spinner" />
            <span>Generating...</span>
          </div>
        )}

        {status === 'done' && (
          <>
            <div className="ai-rewrite-preview">
              <div className="ai-rewrite-section">
                <div className="ai-rewrite-label">AI Response</div>
                <div className="ai-rewrite-content">{result}</div>
              </div>
            </div>
            <div className="actions">
              <button className="btn" onClick={handleReplace}>Replace Card</button>
              <button className="btn primary" onClick={handleNewCard}>Create New Card</button>
              <button className="btn" onClick={handleClose}>Cancel</button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="llm-status error">{errorMsg}</div>
            <div className="actions">
              <button className="btn" onClick={handleClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
