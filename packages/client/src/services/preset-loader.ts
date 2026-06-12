import type { CardPreset } from './llm-generate';

function parsePreset(raw: string): CardPreset | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter: Record<string, string> = {};
  for (const line of fmMatch[1].split('\n')) {
    const [, k, v] = line.match(/^(\w+):\s*(.+)$/) || [];
    if (k && v) frontmatter[k] = v;
  }
  if (!frontmatter.key || !frontmatter.label) return null;

  const body = fmMatch[2].trim();
  const sysMatch = body.match(/## system\n([\s\S]*?)(?=\n## |$)/);
  const promptMatch = body.match(/## prompt\n([\s\S]*?)(?=\n## |$)/);

  return {
    key: frontmatter.key,
    label: frontmatter.label,
    system: (sysMatch?.[1] || body).trim(),
    prompt: (promptMatch?.[1] || body).trim(),
  };
}

// Direct imports of preset .md files
import contextRaw from '../presets/context.md?raw';
import termsRaw from '../presets/terms.md?raw';

const rawPresets = [contextRaw, termsRaw];

export function loadPresets(): CardPreset[] {
  return rawPresets.map(parsePreset).filter(Boolean) as CardPreset[];
}

export const cardPresets = loadPresets();
