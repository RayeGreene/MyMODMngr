import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import {
  Search,
  Download,
  RefreshCw,
  Settings,
  Moon,
  Users,
  Package,
  Layers,
  AlertTriangle,
  HardDrive,
  Keyboard,
  HeartPulse,
  ArrowLeftRight,
} from "lucide-react";
import type { Mod } from "./ModCard";

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: typeof Search;
  category: "navigation" | "actions" | "mods" | "settings";
  handler: () => void;
  /** Keywords for fuzzy matching */
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
  /** Mods to search through */
  mods?: Mod[];
  onViewMod?: (mod: Mod) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  mods = [],
  onViewMod,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [actions, query]);

  const filteredMods = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return mods
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.author.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [mods, query]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const totalItems = filteredActions.length + filteredMods.length;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex < filteredActions.length) {
            filteredActions[selectedIndex].handler();
            onOpenChange(false);
          } else {
            const modIndex = selectedIndex - filteredActions.length;
            if (modIndex < filteredMods.length && onViewMod) {
              onViewMod(filteredMods[modIndex]);
              onOpenChange(false);
            }
          }
          break;
        case "Escape":
          onOpenChange(false);
          break;
      }
    },
    [filteredActions, filteredMods, selectedIndex, totalItems, onOpenChange, onViewMod],
  );

  const categoryOrder: CommandAction["category"][] = [
    "navigation",
    "actions",
    "mods",
    "settings",
  ];
  const grouped = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const a of filteredActions) {
      const list = map.get(a.category) || [];
      list.push(a);
      map.set(a.category, list);
    }
    return categoryOrder
      .filter((c) => map.has(c))
      .map((c) => ({ category: c, items: map.get(c)! }));
  }, [filteredActions]);

  const categoryLabels: Record<string, string> = {
    navigation: "Navigation",
    actions: "Actions",
    mods: "Mods",
    settings: "Settings",
  };

  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-[540px] overflow-hidden gap-0">
        <div className="flex items-center border-b border-border px-3">
          <Search className="w-4 h-4 text-muted-foreground mr-2" />
          <Input
            placeholder="Type a command or search mods..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 focus-visible:ring-0 shadow-none h-12"
            autoFocus
          />
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
            ESC
          </kbd>
        </div>

        <ScrollArea className="max-h-[360px]">
          <div className="p-2">
            {grouped.map(({ category, items }) => (
              <div key={category} className="mb-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                  {categoryLabels[category] || category}
                </div>
                {items.map((action) => {
                  const idx = flatIndex++;
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        idx === selectedIndex
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                      onClick={() => {
                        action.handler();
                        onOpenChange(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0 opacity-60" />
                      <div className="flex-1 text-left">
                        <span>{action.label}</span>
                        {action.description && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {action.description}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Mod search results */}
            {filteredMods.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                  Mods
                </div>
                {filteredMods.map((mod) => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        idx === selectedIndex
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50 text-foreground"
                      }`}
                      onClick={() => {
                        onViewMod?.(mod);
                        onOpenChange(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      {mod.images[0] ? (
                        <img
                          src={mod.images[0]}
                          alt=""
                          className="w-6 h-6 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <Package className="w-4 h-4 flex-shrink-0 opacity-60" />
                      )}
                      <div className="flex-1 text-left truncate">
                        <span>{mod.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          by {mod.author}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {totalItems === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No results found
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border px-3 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="bg-muted px-1 rounded font-mono">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted px-1 rounded font-mono">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted px-1 rounded font-mono">Esc</kbd> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Helper to build default command actions */
export function buildDefaultActions(callbacks: {
  onNavigateDownloads?: () => void;
  onNavigateActive?: () => void;
  onNavigateCharacters?: () => void;
  onNavigateLoadouts?: () => void;
  onNavigateUpdates?: () => void;
  onNavigateConflicts?: () => void;
  onNavigateHealth?: () => void;
  onNavigateStorage?: () => void;
  onOpenSettings?: () => void;
  onRefresh?: () => void;
  onToggleTheme?: () => void;
  onShowShortcuts?: () => void;
  onOpenCompare?: () => void;
}): CommandAction[] {
  const actions: CommandAction[] = [];

  if (callbacks.onNavigateDownloads) {
    actions.push({
      id: "nav-downloads",
      label: "Go to Downloads",
      icon: Download,
      category: "navigation",
      handler: callbacks.onNavigateDownloads,
      keywords: ["browse", "mods", "installed"],
    });
  }
  if (callbacks.onNavigateActive) {
    actions.push({
      id: "nav-active",
      label: "Go to Active Mods",
      icon: Package,
      category: "navigation",
      handler: callbacks.onNavigateActive,
    });
  }
  if (callbacks.onNavigateCharacters) {
    actions.push({
      id: "nav-characters",
      label: "Browse by Character",
      icon: Users,
      category: "navigation",
      handler: callbacks.onNavigateCharacters,
      keywords: ["hero", "skin"],
    });
  }
  if (callbacks.onNavigateLoadouts) {
    actions.push({
      id: "nav-loadouts",
      label: "Manage Loadouts",
      icon: Layers,
      category: "navigation",
      handler: callbacks.onNavigateLoadouts,
      keywords: ["preset", "collection"],
    });
  }
  if (callbacks.onNavigateUpdates) {
    actions.push({
      id: "nav-updates",
      label: "Update Center",
      icon: RefreshCw,
      category: "navigation",
      handler: callbacks.onNavigateUpdates,
    });
  }
  if (callbacks.onNavigateConflicts) {
    actions.push({
      id: "nav-conflicts",
      label: "View Conflicts",
      icon: AlertTriangle,
      category: "navigation",
      handler: callbacks.onNavigateConflicts,
    });
  }
  if (callbacks.onNavigateHealth) {
    actions.push({
      id: "nav-health",
      label: "Mod Health Monitor",
      icon: HeartPulse,
      category: "navigation",
      handler: callbacks.onNavigateHealth,
      keywords: ["health", "status", "issues"],
    });
  }
  if (callbacks.onNavigateStorage) {
    actions.push({
      id: "nav-storage",
      label: "Storage Analytics",
      icon: HardDrive,
      category: "navigation",
      handler: callbacks.onNavigateStorage,
    });
  }
  if (callbacks.onRefresh) {
    actions.push({
      id: "action-refresh",
      label: "Refresh Mods",
      icon: RefreshCw,
      category: "actions",
      handler: callbacks.onRefresh,
    });
  }
  if (callbacks.onOpenSettings) {
    actions.push({
      id: "settings-open",
      label: "Open Settings",
      icon: Settings,
      category: "settings",
      handler: callbacks.onOpenSettings,
    });
  }
  if (callbacks.onToggleTheme) {
    actions.push({
      id: "settings-theme",
      label: "Toggle Theme",
      description: "Switch light/dark mode",
      icon: Moon,
      category: "settings",
      handler: callbacks.onToggleTheme,
    });
  }
  if (callbacks.onShowShortcuts) {
    actions.push({
      id: "settings-shortcuts",
      label: "Keyboard Shortcuts",
      icon: Keyboard,
      category: "settings",
      handler: callbacks.onShowShortcuts,
    });
  }
  if (callbacks.onOpenCompare) {
    actions.push({
      id: "action-compare",
      label: "Compare Mods",
      description: "Side-by-side mod comparison",
      icon: ArrowLeftRight,
      category: "actions",
      handler: callbacks.onOpenCompare,
      keywords: ["compare", "diff", "versus"],
    });
  }

  return actions;
}
