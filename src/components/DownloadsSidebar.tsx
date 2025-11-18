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
  Heart,
} from "lucide-react";

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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

import type { Mod } from "./ModCard";
import {
  listConflicts,
  refreshConflicts,
  checkModUpdate,
  getPakVersionStatus,
  type ApiConflict,
  getDownloadsSummary,
  type ApiDownloadsSummary,
} from "../lib/api";
import { toast } from "sonner";
import {
  deriveCategoryTags,
  extractNonCategoryTags,
} from "../lib/categoryUtils";
import { openInBrowser } from "../lib/tauri-utils";

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

const calculateTotalSize = (mods: Mod[]): string => {
  // Sum up file sizes from all mod entries
  // Assuming each mod might have a size property or we estimate from version/download data
  // For now, return "Calculating..." if no data or sum available sizes
  let totalBytes = 0;
  for (const mod of mods) {
    // If mod has a size property, use it; otherwise estimate
    // This can be extended when the Mod interface includes a size field
    // totalBytes += mod.size || 0;
  }

  if (totalBytes === 0) {
    return "Calculating...";
  }

  if (totalBytes >= 1024 * 1024 * 1024) {
    return (totalBytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  } else if (totalBytes >= 1024 * 1024) {
    return (totalBytes / (1024 * 1024)).toFixed(1) + " MB";
  }
  return (totalBytes / 1024).toFixed(1) + " KB";
};

const getLastCheckTime = (mods: Mod[]): string => {
  // Find the most recent lastUpdatedRaw or lastUpdated timestamp across all mods
  let mostRecentTime = 0;
  for (const mod of mods) {
    const timestamp = mod.lastUpdatedRaw
      ? new Date(mod.lastUpdatedRaw).getTime()
      : mod.lastUpdated
      ? new Date(mod.lastUpdated).getTime()
      : 0;
    if (timestamp > mostRecentTime) {
      mostRecentTime = timestamp;
    }
  }

  if (mostRecentTime === 0) {
    return "Never";
  }

  const now = Date.now();
  const diffMs = now - mostRecentTime;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  }

  return new Date(mostRecentTime).toLocaleDateString();
};

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
  const [downloadsSummary, setDownloadsSummary] =
    useState<ApiDownloadsSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingConflicts, setLoadingConflicts] = useState(false);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const showActiveOnly = true;
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [upiModalOpen, setUpiModalOpen] = useState(false);
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
    // Mark the check start time so the UI shows "Just now" immediately
    const nowIso = new Date().toISOString();
    setDownloadsSummary((prev: ApiDownloadsSummary | null) => {
      if (prev) return { ...prev, last_check: nowIso };
      return {
        ok: true,
        total_size_bytes: 0,
        total_size_human: "0 B",
        download_count: 0,
        missing_paths: [],
        last_check: nowIso,
      };
    });
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
          if (result?.metadata_warning) {
            metadataWarnings.add(result.metadata_warning);
          }
          if (result?.needs_update) {
            // verify pak-level rows to avoid false positives
            try {
              const pakRows = await getPakVersionStatus({
                modId,
                onlyNeedsUpdate: true,
              });
              if (Array.isArray(pakRows) && pakRows.length > 0) {
                flaggedForUpdate += 1;
              } else {
                console.debug(
                  "[downloads-sidebar] mod reported needs_update but no pak rows",
                  { modId }
                );
              }
            } catch (e) {
              // conservative: count it if verification fails
              flaggedForUpdate += 1;
              console.warn(
                "[downloads-sidebar] failed to verify pak level status",
                { modId, error: e }
              );
            }
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
      // Refresh authoritative downloads summary after checks complete
      try {
        setLoadingSummary(true);
        const s = await getDownloadsSummary();
        // Preserve the check timestamp (nowIso) so UI shows the actual check time
        setDownloadsSummary({ ...s, last_check: nowIso });
      } catch (err) {
        console.error(
          "Failed to refresh downloads summary after update check",
          err
        );
      } finally {
        setLoadingSummary(false);
      }
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

  // Lightweight effect to keep a conflict count for the sidebar button
  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      try {
        const data = await listConflicts(200, showActiveOnly);
        if (!cancelled) setConflictCount(Array.isArray(data) ? data.length : 0);
      } catch (err) {
        if (!cancelled) setConflictCount(0);
      }
    }
    loadCount();
    return () => {
      cancelled = true;
    };
  }, [mods, conflictsReloadToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      setLoadingSummary(true);
      try {
        const s = await getDownloadsSummary();
        if (!cancelled) setDownloadsSummary(s);
      } catch (err) {
        console.error("Failed to load downloads summary", err);
        if (!cancelled) setDownloadsSummary(null);
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    }
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [mods, conflictsReloadToken]);

  const formattedConflicts = (conflicts || []).map((mc) => ({
    asset_path: mc.asset_path,
    category: mc.category,
    conflicting_mod_count: mc.conflicting_mod_count,
    total_paks: mc.total_paks,
    participants: mc.participants,
  }));

  const handleDonateClick = (platform: "kofi" | "upi") => {
    if (platform === "kofi") {
      // Open Ko-fi in browser
      openInBrowser("https://ko-fi.com/rsted");
    } else if (platform === "upi") {
      // Show UPI modal
      setUpiModalOpen(true);
    }
  };

  return (
    <div
      className="bg-card border-r border-border h-full flex flex-col overflow-y-auto sidebar-hide-scrollbar"
      style={{
        width: "18rem",
        minWidth: "18rem",
        maxWidth: "18rem",
        flex: "0 0 18rem",
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
        .donate-button {
          height: 32px;
          padding: 5px;
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
                  disabled={false}
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
            {conflictCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {conflictCount}
              </Badge>
            )}
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
            <span>
              {loadingSummary
                ? "Calculating..."
                : downloadsSummary
                ? downloadsSummary.total_size_human
                : calculateTotalSize(installedMods)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Check:</span>
            <span>
              {loadingSummary
                ? "..."
                : downloadsSummary && downloadsSummary.last_check
                ? (() => {
                    try {
                      const d = new Date(downloadsSummary.last_check as string);
                      const now = Date.now();
                      const diffMs = now - d.getTime();
                      const diffMins = Math.floor(diffMs / (1000 * 60));
                      if (diffMins < 1) return "Just now";
                      if (diffMins < 60)
                        return `${diffMins} min${
                          diffMins !== 1 ? "s" : ""
                        } ago`;
                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                      if (diffHours < 24)
                        return `${diffHours} hour${
                          diffHours !== 1 ? "s" : ""
                        } ago`;
                      const diffDays = Math.floor(
                        diffMs / (1000 * 60 * 60 * 24)
                      );
                      if (diffDays < 30)
                        return `${diffDays} day${
                          diffDays !== 1 ? "s" : ""
                        } ago`;
                      return d.toLocaleDateString();
                    } catch (e) {
                      return String(downloadsSummary.last_check);
                    }
                  })()
                : getLastCheckTime(installedMods)}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      <div style={{ padding: "10px 10px 15px" }}>
        <h4 className="font-medium mb-4 flex justify-center items-center gap-2">
          <Heart
            className="w-4 h-4 text-red-500"
            style={{ paddingTop: "2px" }}
          />
          Support Development
        </h4>
        <div className="flex gap-4 justify-center">
          <Button
            className="donate-button"
            style={{ width: "80px" }}
            variant="outline"
            size="sm"
            onClick={() => handleDonateClick("kofi")}
          >
            <img
              src="/icons/kofi.svg"
              alt="Ko-fi"
              style={{ width: "40px", height: "15px" }}
            />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="donate-button"
            style={{ width: "80px" }}
            onClick={() => handleDonateClick("upi")}
          >
            <img
              src="/icons/upi.svg"
              alt="UPI"
              style={{ width: "40px", height: "12px" }}
            />
          </Button>
        </div>
      </div>

      {/* UPI Donation Modal */}
      <Dialog open={upiModalOpen} onOpenChange={setUpiModalOpen}>
        <DialogContent className="sm:max-w-xs max-w-[280px]">
          <DialogHeader>
            <DialogTitle className="text-base">UPI Donation</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-3 py-2">
            <img
              src="/icons/qr.png"
              alt="UPI QR Code"
              className="object-contain"
              style={{ width: "300px" }}
            />
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">UPI ID:</p>
              <p className="font-mono text-sm font-semibold">
                rounaks255@oksbi
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Scan with UPI app
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
