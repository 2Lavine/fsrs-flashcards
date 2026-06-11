import { useRef, useEffect } from 'react';

type HotkeyHandler = (e: KeyboardEvent) => void;

interface HotkeyDef {
  keys: string;
  handler: HotkeyHandler;
  enabled: () => boolean;
}

// Map shortcut names to e.key values
const KEY_MAP: Record<string, string> = {
  space: ' ',
  enter: 'Enter',
  escape: 'Escape',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
};

function matchKey(eventKey: string, shortcutKey: string): boolean {
  const resolved = KEY_MAP[shortcutKey] ?? shortcutKey;
  return eventKey.toLowerCase() === resolved.toLowerCase();
}

/**
 * Low-level keyboard shortcut hook.
 * Uses native addEventListener + refs — zero deps, no stale closures.
 */
export function useReviewHotkeys(hotkeys: HotkeyDef[]) {
  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) return;

      for (const hk of hotkeysRef.current) {
        const parts = hk.keys.toLowerCase().split('+');
        const key = parts[parts.length - 1];
        const mod = parts.length > 1 ? parts[0] : null;

        // Check modifier: if hotkey expects mod, verify it's held
        if (mod === 'mod' && !(e.metaKey || e.ctrlKey)) continue;
        if (mod && mod !== 'mod' && !e.getModifierState?.(mod)) continue;

        // If hotkey expects NO modifier, verify none are held
        if (!mod && (e.metaKey || e.ctrlKey || e.altKey)) continue;

        // Check key
        if (!matchKey(e.key, key)) continue;

        // Check enabled
        if (!hk.enabled()) continue;

        e.preventDefault();
        hk.handler(e);
        break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
