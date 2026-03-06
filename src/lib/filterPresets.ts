/**
 * Filter Presets (Feature T) — save and load advanced filter configurations.
 */

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterConfig;
  createdAt: number;
}

export interface FilterConfig {
  searchQuery?: string;
  characters?: string[];
  categories?: string[];
  tags?: string[];
  hasUpdate?: boolean;
  isActive?: boolean;
  isFavorited?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  dateRange?: { from?: string; to?: string };
}

const STORAGE_KEY = "rivalnxt:filter-presets";

let listeners: Array<() => void> = [];

function getAll(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(presets: FilterPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  listeners.forEach((fn) => fn());
}

export function listFilterPresets(): FilterPreset[] {
  return getAll();
}

export function createFilterPreset(name: string, filters: FilterConfig): FilterPreset {
  const preset: FilterPreset = {
    id: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    filters,
    createdAt: Date.now(),
  };
  const all = getAll();
  all.push(preset);
  save(all);
  return preset;
}

export function deleteFilterPreset(id: string) {
  save(getAll().filter((p) => p.id !== id));
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
