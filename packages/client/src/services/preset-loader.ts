import type { CardPreset } from './llm-generate';

const RAW_PRESETS = import.meta.glob('../presets/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function parseFrontmatter(raw: string): Record<string, string> {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return {};
  const out: Record<string, string> = {};
  for (const line of fmMatch[1].split('\n')) {
    const [, k, v] = line.match(/^(\w+):\s*(.+)$/) || [];
    if (k && v) out[k] = v.trim();
  }
  return out;
}

function parsePreset(raw: string): CardPreset | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;
  const fm = parseFrontmatter(raw);
  if (!fm.key || !fm.label) return null;

  const body = fmMatch[2].trim();
  const sysMatch = body.match(/## system\n([\s\S]*?)(?=\n## |$)/);
  const promptMatch = body.match(/## prompt\n([\s\S]*?)(?=\n## |$)/);

  const outputType = fm.outputType === 'explanation' ? 'explanation' : 'cards';

  return {
    key: fm.key,
    label: fm.label,
    description: fm.description,
    icon: fm.icon,
    outputType,
    system: (sysMatch?.[1] || body).trim(),
    prompt: (promptMatch?.[1] || body).trim(),
  };
}

export function loadPresets(): CardPreset[] {
  return Object.values(RAW_PRESETS)
    .map(parsePreset)
    .filter((p): p is CardPreset => p !== null);
}

export const cardPresets = loadPresets();
