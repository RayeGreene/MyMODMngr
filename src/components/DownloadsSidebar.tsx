import { Button } from "./ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModConflictModal } from "./ModConflictModal";
// import { mockConflicts } from "./mockConflicts";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Checkbox } from "./ui/checkbox";
import {
  Users,
  Palette,
  Map,
  Settings,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import type { Mod } from "./ModCard";
import {
  listConflicts,
  refreshConflicts,
  checkModUpdate,
  type ApiConflict,
} from "../lib/api";
import { toast } from "sonner";
import {
  deriveCategoryTags,
  extractNonCategoryTags,
} from "../lib/categoryUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

interface DownloadsSidebarProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  installedCounts: Record<string, number>;
  updatesCount: number;
  selectedCharacters?: string[];
  onCharacterToggle?: (character: string) => void;
  mods: Mod[];
  conflictsReloadToken?: number;
}

const categories = [
  { id: "all", label: "All Installed", icon: CheckCircle },
  { id: "characters", label: "Characters", icon: Users },
  { id: "ui", label: "User Interface", icon: Palette },
  { id: "maps", label: "Maps & Environments", icon: Map },
  { id: "audio", label: "Audio & Music", icon: Settings },
];

export function DownloadsSidebar({
  selectedCategory,
  onCategoryChange,
  installedCounts,
  updatesCount,
  selectedCharacters = [],
  onCharacterToggle,
  mods,
  conflictsReloadToken = 0,
}: DownloadsSidebarProps) {
  const installedMods = mods.filter((mod) => mod.isInstalled);
  // Map category to character counts for installed mods in that category
  const categoryCharacterCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
    for (const mod of installedMods) {
      const categoriesForMod = deriveCategoryTags(mod.tags);
      if (categoriesForMod.length === 0) {
        continue;
      }
      const characterTags = extractNonCategoryTags(mod.tags);
      if (characterTags.length === 0) {
        continue;
      }
      for (const categoryId of categoriesForMod) {
        if (!counts[categoryId]) {
          counts[categoryId] = {};
        }
        for (const tag of characterTags) {
          if (!tag) continue;
          counts[categoryId][tag] = (counts[categoryId][tag] || 0) + 1;
        }
      }
    }
    return counts;
  }, [installedMods]);

  const sortedCharactersByCategory = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const [categoryId, characterCounts] of Object.entries(
      categoryCharacterCounts
    )) {
      result[categoryId] = Object.entries(characterCounts)
        .filter(([, count]) => count > 0)
        .map(([char]) => char)
        .sort((a, b) => a.localeCompare(b));
    }
    return result;
  }, [categoryCharacterCounts]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ApiConflict[] | null>(null);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const showActiveOnly = true;
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  const uniqueModIds = useMemo(() => {
    const ids = new Set<number>();
    for (const mod of installedMods) {
      if (typeof mod.backendModId === "number" && mod.backendModId > 0) {
        ids.add(mod.backendModId);
      }
    }
    return Array.from(ids);
  }, [installedMods]);

  const handleStartUpdateCheck = useCallback(async () => {
    if (isCheckingUpdates) {
      return;
    }
    setUpdateConfirmOpen(false);
    if (uniqueModIds.length === 0) {
      toast.info("No installed mods are linked to Nexus IDs to check.");
      return;
    }
    const toastId = "check-updates-progress";
    setIsCheckingUpdates(true);
    let checked = 0;
    let failed = 0;
    let flaggedForUpdate = 0;
    const metadataWarnings = new Set<string>();
    toast.loading(`(0/${uniqueModIds.length}) mods checked ...`, {
      id: toastId,
    });
    try {
      for (const modId of uniqueModIds) {
        try {
          const result = await checkModUpdate(modId);
          if (result?.needs_update) {
            flaggedForUpdate += 1;
          }
          if (result?.metadata_warning) {
            metadataWarnings.add(result.metadata_warning);
          }
        } catch (error) {
          failed += 1;
          console.error("[downloads-sidebar] update check failed", {
            modId,
            error,
          });
        } finally {
          checked += 1;
          toast.loading(
            `(${checked}/${uniqueModIds.length}) mods checked ...`,
            {
              id: toastId,
            }
          );
        }
      }
      const details: string[] = [];
      if (flaggedForUpdate > 0) {
        details.push(`${flaggedForUpdate} need updates`);
      }
      if (failed > 0) {
        details.push(`${failed} failed`);
      }
      const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
      const warningDescription =
        metadataWarnings.size > 0
          ? Array.from(metadataWarnings).join("\n")
          : undefined;
      toast.success(
        `Finished checking ${checked} mod${checked === 1 ? "" : "s"}${suffix}.`,
        { id: toastId, description: warningDescription }
      );
    } finally {
      setIsCheckingUpdates(false);
    }
  }, [isCheckingUpdates, uniqueModIds]);

  useEffect(() => {
    if (!conflictModalOpen) return;
    let cancelled = false;
    async function load() {
      try {
        setLoadingConflicts(true);
        try {
          await refreshConflicts();
        } catch (err) {
          if (!cancelled) {
            const message =
              err instanceof Error
                ? err.message
                : "Failed to refresh conflicts";
            toast.error(message);
          }
          if (cancelled) return;
        }
        const data = await listConflicts(50, showActiveOnly);
        if (!cancelled) setConflicts(data);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load conflicts";
          toast.error(message);
          setConflicts([]);
        }
      } finally {
        if (!cancelled) setLoadingConflicts(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [conflictModalOpen, conflictsReloadToken, showActiveOnly]);

  const formattedConflicts = (conflicts || []).map((mc) => ({
    asset_path: mc.asset_path,
    category: mc.category,
    conflicting_mod_count: mc.conflicting_mod_count,
    total_paks: mc.total_paks,
    participants: mc.participants,
  }));

  return (
    <div
      className="w-80 bg-card border-r border-border h-full flex flex-col overflow-y-auto sidebar-hide-scrollbar"
      style={{
        width: "20rem",
        minWidth: "20rem",
        maxWidth: "20rem",
        flex: "0 0 20rem",
        scrollbarWidth: "none", // Firefox
        msOverflowStyle: "none", // IE 10+
        overflowY: "auto",
      }}
    >
      {/* Hide scrollbar for Chrome, Safari and Opera */}
      <style>{`
        .sidebar-hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="p-4">
        <div className="space-y-1">
          {categories.map((category) => {
            const Icon = category.icon;
            const count = installedCounts[category.id] || 0;
            const characterCountsForCategory =
              categoryCharacterCounts[category.id] || {};
            const charactersForCategory =
              sortedCharactersByCategory[category.id] || [];

            // If any selected category (except 'all') is clicked again, go to 'all'.
            // If 'all' is clicked again, collapse (deselect).
            const handleCategoryClick = () => {
              if (selectedCategory === category.id) {
                if (category.id === "all") {
                  onCategoryChange("");
                } else {
                  onCategoryChange("all");
                }
              } else {
                onCategoryChange(category.id);
              }
            };

            return (
              <div key={category.id}>
                <Button
                  variant={
                    selectedCategory === category.id ? "secondary" : "ghost"
                  }
                  className="w-full justify-start gap-3 h-10 min-w-0"
                  onClick={handleCategoryClick}
                  disabled={count === 0 && category.id !== "all"}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate text-left">
                    {category.label}
                  </span>
                  {count > 0 && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {count}
                    </Badge>
                  )}
                </Button>

                {/* Character Subcategories Dropdown for all except 'all' */}
                {category.id !== "all" &&
                  selectedCategory === category.id &&
                  onCharacterToggle &&
                  count > 0 && (
                    <Collapsible defaultOpen className="mt-2 ml-6">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 h-8 text-sm"
                        >
                          <ChevronDown className="w-3 h-3" />
                          Filter by Character
                          {selectedCharacters.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-xs ml-auto"
                            >
                              {selectedCharacters.length}
                            </Badge>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 mt-2">
                        {charactersForCategory.map((character) => (
                          <div
                            key={character}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`installed-character-${character}`}
                              checked={selectedCharacters.includes(character)}
                              onCheckedChange={() =>
                                onCharacterToggle(character)
                              }
                            />
                            <label
                              htmlFor={`installed-character-${character}`}
                              className="text-sm cursor-pointer flex-1 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {character}
                              {characterCountsForCategory[character] > 0 && (
                                <span className="ml-1 text-muted-foreground">
                                  ({characterCountsForCategory[character]})
                                </span>
                              )}
                            </label>
                          </div>
                        ))}
                        {selectedCharacters.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              selectedCharacters.forEach((char) =>
                                onCharacterToggle(char)
                              );
                            }}
                          >
                            Clear Selection
                          </Button>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="p-6">
        <h3 className="font-medium mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            disabled={isCheckingUpdates || uniqueModIds.length === 0}
            onClick={() => setUpdateConfirmOpen(true)}
          >
            <RefreshCw className="w-4 h-4" />
            <span className="flex-1 text-left">Check for Updates</span>
            {updatesCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {updatesCount}
              </Badge>
            )}
          </Button>
          {isCheckingUpdates && (
            <p className="text-xs text-muted-foreground">
              Checking updates in the background…
            </p>
          )}

          <Button
            variant="outline"
            className="w-full justify-start gap-3"
            onClick={() => setConflictModalOpen(true)}
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="flex-1 text-left">Check for Conflicts</span>
          </Button>
          {/* Mod Conflict Modal */}
          <ModConflictModal
            open={conflictModalOpen}
            onOpenChange={setConflictModalOpen}
            conflicts={formattedConflicts}
            title={
              showActiveOnly ? "Active Mod Conflicts" : "All Mod Conflicts"
            }
          />
          {conflictModalOpen && (
            <div className="mt-2 text-xs text-muted-foreground">
              {loadingConflicts ? "Loading conflicts…" : ""}
            </div>
          )}

          <Button variant="outline" className="w-full justify-start gap-3">
            <Clock className="w-4 h-4" />
            <span className="flex-1 text-left">Recent Activity</span>
          </Button>
        </div>

        <AlertDialog
          open={updateConfirmOpen}
          onOpenChange={setUpdateConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Check for updates?</AlertDialogTitle>
              <AlertDialogDescription>
                {uniqueModIds.length > 0
                  ? `This will contact the API for ${
                      uniqueModIds.length
                    } installed mod${
                      uniqueModIds.length === 1 ? "" : "s"
                    } to refresh their update status.`
                  : "No installed mods have Nexus metadata to check."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCheckingUpdates}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleStartUpdateCheck}
                disabled={isCheckingUpdates || uniqueModIds.length === 0}
              >
                Start Check
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Separator />

      <div className="flex-1 p-6">
        <h3 className="font-medium mb-3">Installation Info</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Installed:</span>
            <span>{installedCounts.all || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Needs Updates:</span>
            <span className={updatesCount > 0 ? "text-destructive" : ""}>
              {updatesCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Size:</span>
            <span>2.4 GB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Check:</span>
            <span>2 hours ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}
