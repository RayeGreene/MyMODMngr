/**
 * Keyboard Shortcuts Registry (Feature N).
 * Centralized shortcut management with help overlay support.
 */

export interface ShortcutEntry {
  /** Key combo, e.g., "Ctrl+K", "Ctrl+Shift+F" */
  keys: string;
  /** Human-readable description */
  label: string;
  /** Category for grouping in help overlay */
  category: "navigation" | "actions" | "view" | "search";
  /** Handler function */
  handler: (e: KeyboardEvent) => void;
}

const registry: ShortcutEntry[] = [];

/**
 * Register a keyboard shortcut. Returns unregister function.
 */
export function registerShortcut(entry: ShortcutEntry): () => void {
  registry.push(entry);
  return () => {
    const idx = registry.indexOf(entry);
    if (idx >= 0) registry.splice(idx, 1);
  };
}

export function getRegisteredShortcuts(): ShortcutEntry[] {
  return [...registry];
}

/**
 * Parse a key combo string like "Ctrl+K" into match criteria.
 */
function parseCombo(keys: string) {
  const parts = keys.toLowerCase().split("+").map((s) => s.trim());
  return {
    ctrl: parts.includes("ctrl") || parts.includes("cmd"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    key: parts.filter((p) => !["ctrl", "cmd", "shift", "alt"].includes(p))[0] || "",
  };
}

/**
 * Global keydown handler — call this from a top-level useEffect.
 */
export function handleGlobalKeyDown(e: KeyboardEvent) {
  // Don't intercept when user is typing in an input/textarea
  const target = e.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    // Exception: allow Escape key
    if (e.key !== "Escape") return;
  }

  for (const entry of registry) {
    const combo = parseCombo(entry.keys);
    const ctrlMatch = combo.ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
    const shiftMatch = combo.shift ? e.shiftKey : !e.shiftKey;
    const altMatch = combo.alt ? e.altKey : !e.altKey;
    const keyMatch = e.key.toLowerCase() === combo.key;

    if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
      e.preventDefault();
      e.stopPropagation();
      entry.handler(e);
      return;
    }
  }
}
