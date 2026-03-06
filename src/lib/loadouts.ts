/**
 * Loadout System (Feature H) — save/load groups of mods as named presets.
 * Stored in localStorage.
 */

export interface Loadout {
  id: string;
  name: string;
  description?: string;
  /** Array of mod IDs included in this loadout */
  modIds: string[];
  /** Thumbnail URL (first mod's image) */
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "rivalnxt:loadouts";

let listeners: Array<() => void> = [];

function getAll(): Loadout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(loadouts: Loadout[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadouts));
  listeners.forEach((fn) => fn());
}

export function listLoadouts(): Loadout[] {
  return getAll();
}

export function createLoadout(
  name: string,
  modIds: string[],
  options?: { description?: string; thumbnail?: string },
): Loadout {
  const loadout: Loadout = {
    id: `loadout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: options?.description,
    modIds,
    thumbnail: options?.thumbnail,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const all = getAll();
  all.push(loadout);
  save(all);
  return loadout;
}

export function updateLoadout(id: string, patch: Partial<Omit<Loadout, "id" | "createdAt">>) {
  const all = getAll();
  const idx = all.findIndex((l) => l.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() };
    save(all);
    return all[idx];
  }
  return null;
}

export function deleteLoadout(id: string) {
  const all = getAll().filter((l) => l.id !== id);
  save(all);
}

export function getLoadout(id: string): Loadout | undefined {
  return getAll().find((l) => l.id === id);
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
