/**
 * Activity Log — tracks user actions for the Activity Feed (Feature K).
 * Persisted in localStorage with a rolling window.
 */

export type ActivityAction =
  | "install"
  | "uninstall"
  | "update"
  | "activate"
  | "deactivate"
  | "favorite"
  | "unfavorite"
  | "loadout_activate"
  | "loadout_save"
  | "settings_change";

export interface ActivityEntry {
  id: string;
  action: ActivityAction;
  modName?: string;
  modId?: string;
  detail?: string;
  timestamp: number;
}

const STORAGE_KEY = "rivalnxt:activity-log";
const MAX_ENTRIES = 200;

let listeners: Array<() => void> = [];

function getEntries(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(entries: ActivityEntry[]) {
  const trimmed = entries.slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  listeners.forEach((fn) => fn());
}

export function logActivity(
  entry: Omit<ActivityEntry, "id" | "timestamp">,
): ActivityEntry {
  const full: ActivityEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };
  const all = getEntries();
  all.unshift(full);
  save(all);
  return full;
}

export function listActivities(): ActivityEntry[] {
  return getEntries();
}

export function clearActivities() {
  save([]);
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/** Human-readable label for an action */
export function actionLabel(action: ActivityAction): string {
  switch (action) {
    case "install": return "Installed";
    case "uninstall": return "Uninstalled";
    case "update": return "Updated";
    case "activate": return "Activated";
    case "deactivate": return "Deactivated";
    case "favorite": return "Favorited";
    case "unfavorite": return "Unfavorited";
    case "loadout_activate": return "Loadout Activated";
    case "loadout_save": return "Loadout Saved";
    case "settings_change": return "Settings Changed";
    default: return action;
  }
}
