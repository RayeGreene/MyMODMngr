/**
 * Favorites & Bookmarks system (Feature AA).
 * Manages wishlists, recently viewed, and pinned mods.
 */

const WISHLIST_KEY = "rivalnxt:wishlist";
const RECENT_KEY = "rivalnxt:recent-viewed";
const MAX_RECENT = 20;

let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((fn) => fn());
}

// --- Wishlist (Install Later) ---

export function getWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToWishlist(modId: string) {
  const list = getWishlist();
  if (!list.includes(modId)) {
    list.push(modId);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    notify();
  }
}

export function removeFromWishlist(modId: string) {
  const list = getWishlist().filter((id) => id !== modId);
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
  notify();
}

export function isInWishlist(modId: string): boolean {
  return getWishlist().includes(modId);
}

// --- Recently Viewed ---

export interface RecentViewEntry {
  modId: string;
  timestamp: number;
}

export function getRecentlyViewed(): RecentViewEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function trackView(modId: string) {
  let list = getRecentlyViewed().filter((e) => e.modId !== modId);
  list.unshift({ modId, timestamp: Date.now() });
  list = list.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  notify();
}

// --- Subscription ---

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
