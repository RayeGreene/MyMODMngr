/**
 * Notification system store.
 * Provides a simple event-based notification center with localStorage persistence.
 */

export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  /** Optional action label */
  actionLabel?: string;
  /** Optional action callback key (handled by consumer) */
  actionKey?: string;
}

const STORAGE_KEY = "rivalnxt:notifications";
const MAX_NOTIFICATIONS = 100;

let listeners: Array<() => void> = [];

function getNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(notifications: AppNotification[]) {
  const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  listeners.forEach((fn) => fn());
}

export function addNotification(
  notification: Omit<AppNotification, "id" | "timestamp" | "read">,
): AppNotification {
  const entry: AppNotification = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    read: false,
  };
  const all = getNotifications();
  all.unshift(entry);
  save(all);
  return entry;
}

export function markRead(id: string) {
  const all = getNotifications();
  const item = all.find((n) => n.id === id);
  if (item) {
    item.read = true;
    save(all);
  }
}

export function markAllRead() {
  const all = getNotifications();
  all.forEach((n) => (n.read = true));
  save(all);
}

export function clearNotifications() {
  save([]);
}

export function removeNotification(id: string) {
  const all = getNotifications().filter((n) => n.id !== id);
  save(all);
}

export function listNotifications(): AppNotification[] {
  return getNotifications();
}

export function unreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

/** Subscribe to notification changes. Returns unsubscribe function. */
export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
