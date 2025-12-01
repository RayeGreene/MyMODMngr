import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
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
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Download, Star, Heart, Calendar, File, Trash2, ExternalLink } from "lucide-react";
import type { Mod } from "./ModCard";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SyntheticEvent,
} from "react";
import DOMPurify from "dompurify";
import {
  getModChangelogs,
  getModDetails,
  type ApiChangelog,
  type ApiModDetails,
} from "../lib/api";
import { Switch } from "./ui/switch";
import {
  setActivePaks,
  scanActive,
  getLocalDownload,
  getPakVersionStatus,
  refreshConflicts,
  deleteLocalDownloads,
  type ApiPakVersionStatus,
} from "../lib/api";
import { toast } from "sonner";

type DownloadEntry = {
  id: number;
  path: string;
  contents: string[];
  active_paks: string[];
  version: string | null;
  created_at?: string | null;
  name?: string | null;
};

type PakGroup = { primary: string; files: string[] };

function groupPakEntries(contents: string[] | null | undefined): PakGroup[] {
  if (!Array.isArray(contents)) {
    return [];
  }
  const groups = new Map<string, PakGroup>();
  for (const fileName of contents) {
    if (typeof fileName !== "string" || !fileName) continue;
    const stem = fileName.replace(/\.(pak|utoc|ucas|sig)$/i, "");
    const key = stem || fileName;
    const current = groups.get(key) ?? { primary: fileName, files: [] };
    current.files.push(fileName);
    if (/\.pak$/i.test(fileName)) {
      current.primary = fileName;
    } else if (!/\.pak$/i.test(current.primary)) {
      current.primary = current.primary || fileName;
    }
    groups.set(key, current);
  }
  return Array.from(groups.values()).filter((entry) =>
    entry.files.some((file) => /\.pak$/i.test(file))
  );
}

function toActiveMap(entries: DownloadEntry[]): Record<number, string[]> {
  const map: Record<number, string[]> = {};
  for (const entry of entries) {
    map[entry.id] = Array.isArray(entry.active_paks)
      ? [...entry.active_paks]
      : [];
  }
  return map;
}

const toBasename = (value: string): string => {
  if (typeof value !== "string") return "";
  const parts = value.split(/[/\\]/);
  const last = parts[parts.length - 1];
  return last || value;
};

const normalizeVersion = (version?: string | null): string => {
  if (!version) return "Unknown";
  const trimmed = version.trim();
  if (!trimmed) return "Unknown";
  const dotParts = trimmed.split(".").filter(Boolean);
  if (dotParts.length > 0) {
    const limited = dotParts.slice(0, 3).map((part, index) => {
      if (index === 0) return part;
      if (part.length > 3) {
        return part.slice(0, 3);
      }
      return part;
    });
    return limited.join(".");
  }
  const numericParts = trimmed.match(/\d+/g);
  if (numericParts && numericParts.length > 0) {
    return numericParts
      .slice(0, 3)
      .map((part, index) => {
        if (index === 0) return part;
        return part.slice(0, 3);
      })
      .join(".");
  }
  return trimmed;
};

const getDownloadDisplayName = (entry: DownloadEntry): string => {
  if (!entry) {
    return "Download";
  }
  if (entry.name && entry.name.trim().length > 0) {
    return entry.name.trim();
  }
  if (entry.path && entry.path.trim().length > 0) {
    const base = toBasename(entry.path.trim());
    if (base.length > 0) {
      return base;
    }
  }
  return `Download #${entry.id}`;
};

interface ModModalProps {
  mod: Mod | null;
  isOpen: boolean;
  onClose: () => void;
  onInstall: (modId: string) => void;
  onFavorite: (modId: string) => void;
  onConflictStateChanged?: () => void;
  onRefresh?: () => void;
}

export function ModModal({
  mod,
  isOpen,
  onClose,
  onInstall,
  onFavorite,
  onConflictStateChanged,
  onRefresh,
}: ModModalProps) {
  const [details, setDetails] = useState<ApiModDetails | null>(null);
  // Files list from server is not needed for toggle UI; using local download contents instead
  // const [files, setFiles] = useState<ApiModFile[] | null>(null);
  const [changelogs, setChangelogs] = useState<ApiChangelog[] | null>(null);

  // Fetch from backend if we have a linked mods.mod_id
  const serverModId = useMemo(() => mod?.backendModId ?? null, [mod]);
  const [isApplying, setIsApplying] = useState(false);
  const downloadIds = useMemo(
    () =>
      Array.isArray(mod?.sourceDownloadIds)
        ? mod.sourceDownloadIds
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
        : [],
    [mod?.sourceDownloadIds]
  );
  const [downloadEntries, setDownloadEntries] = useState<DownloadEntry[]>([]);
  const [activeByDownload, setActiveByDownload] = useState<
    Record<number, string[]>
  >({});
  const [pakStatusByDownload, setPakStatusByDownload] = useState<
    Record<number, Record<string, ApiPakVersionStatus>>
  >({});
  const [deletingDownloadId, setDeletingDownloadId] = useState<number | null>(
    null
  );
  const [deleteDialogEntry, setDeleteDialogEntry] =
    useState<DownloadEntry | null>(null);

  const overviewTags = useMemo(() => {
    const tags: string[] = [];
    const seen = new Set<string>();
    const addTag = (tag?: string | null) => {
      if (tag == null) return;
      const normalized = String(tag).trim();
      if (!normalized) return;
      const lower = normalized.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      tags.push(normalized);
    };

    if (Array.isArray(details?.tags)) {
      details?.tags.forEach(addTag);
    }
    if (Array.isArray(mod?.tags)) {
      mod?.tags.forEach(addTag);
    }
    return tags;
  }, [details, mod]);

  useEffect(() => {
    let cancelled = false;
    async function loadDetails() {
      if (!serverModId) {
        setDetails(null);
        setChangelogs(null);
        return;
      }
      try {
        const [d, c] = await Promise.all([
          getModDetails(serverModId),
          getModChangelogs(serverModId),
        ]);
        const debugInfo = {
          hasDescription: !!d?.mod?.description,
          descriptionLength: d?.mod?.description?.length || 0,
          hasSummary: !!d?.mod?.summary,
          changelogsCount: c?.length || 0,
          modKeys: d?.mod ? Object.keys(d.mod) : [],
        };
        console.log(
          "[ModModal] Loaded details for mod",
          serverModId,
          debugInfo
        );
        try {
          await fetch("http://127.0.0.1:8000/api/debug/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `ModModal loaded details for mod ${serverModId}`,
              data: debugInfo,
              level: "INFO",
            }),
          });
        } catch (e) {
          // Ignore debug logging errors
        }
        if (!cancelled) {
          setDetails(d);
          setChangelogs(c);
        }
      } catch (error) {
        console.error("[ModModal] Error loading details:", error);
        if (!cancelled) {
          setDetails(null);
          setChangelogs(null);
        }
      }
    }
    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [serverModId, isOpen]);

  const hydrateDownloads = useCallback(
    async (options?: { skipScan?: boolean }) => {
      if (!downloadIds.length) {
        return [] as DownloadEntry[];
      }
      if (!options?.skipScan) {
        try {
          await scanActive();
        } catch (error) {
          console.warn("[mod-modal] scanActive failed", error);
        }
      }
      const downloads = await Promise.all(
        downloadIds.map(async (rawId) => {
          try {
            const dl = await getLocalDownload(Number(rawId));
            return {
              id: dl.id,
              path: dl.path,
              contents: Array.isArray(dl.contents) ? dl.contents : [],
              active_paks: Array.isArray(dl.active_paks) ? dl.active_paks : [],
              version:
                dl.version ??
                mod?.installedVersion ??
                mod?.version ??
                mod?.latestVersion ??
                null,
              created_at: dl.created_at ?? null,
              name: dl.name ?? null,
            } as DownloadEntry;
          } catch (error) {
            console.warn(
              "[mod-modal] failed to fetch local download",
              rawId,
              error
            );
            return null;
          }
        })
      );
      const valid = downloads.filter((d): d is DownloadEntry => Boolean(d));
      const idOrder = new Map<number, number>();
      downloadIds.forEach((rawId, index) => {
        const asNumber = Number(rawId);
        if (Number.isFinite(asNumber)) {
          idOrder.set(asNumber, index);
        }
      });
      valid.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (aTime !== bTime) {
          return bTime - aTime;
        }
        const aIndex = idOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = idOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        return a.id - b.id;
      });
      return valid;
    },
    [downloadIds, mod?.installedVersion, mod?.version, mod?.latestVersion]
  );

  const fetchPakStatuses = useCallback(async () => {
    if (!isOpen) {
      return {} as Record<number, Record<string, ApiPakVersionStatus>>;
    }
    const request: {
      modId?: number;
      downloadIds?: number[];
    } = {};
    if (serverModId != null) {
      request.modId = serverModId;
    }
    if (downloadIds.length > 0) {
      request.downloadIds = downloadIds;
    }
    if (!request.modId && !request.downloadIds) {
      return {} as Record<number, Record<string, ApiPakVersionStatus>>;
    }
    try {
      const response = await getPakVersionStatus(request);
      const lookup: Record<number, Record<string, ApiPakVersionStatus>> = {};
      for (const entry of response) {
        const downloadId = entry.local_download_id;
        const pakKey = toBasename(entry.pak_name || "").toLowerCase();
        if (!downloadId || !pakKey) {
          continue;
        }
        if (!lookup[downloadId]) {
          lookup[downloadId] = {};
        }
        lookup[downloadId][pakKey] = entry;
      }
      return lookup;
    } catch (error) {
      console.warn("[mod-modal] failed to fetch pak version status", error);
      return {} as Record<number, Record<string, ApiPakVersionStatus>>;
    }
  }, [downloadIds, isOpen, serverModId]);

  useEffect(() => {
    let cancelled = false;
    async function loadDownloads() {
      if (!mod || !downloadIds.length) {
        setDownloadEntries([]);
        setActiveByDownload({});
        setPakStatusByDownload({});
        return;
      }
      const entries = await hydrateDownloads();
      if (!cancelled) {
        setDownloadEntries(entries);
        setActiveByDownload(toActiveMap(entries));
      }
    }
    loadDownloads();
    return () => {
      cancelled = true;
    };
  }, [hydrateDownloads, isOpen, mod, downloadIds.length]);

  useEffect(() => {
    let cancelled = false;
    async function loadStatuses() {
      const lookup = await fetchPakStatuses();
      if (!cancelled) {
        setPakStatusByDownload(lookup);
      }
    }
    loadStatuses();
    return () => {
      cancelled = true;
    };
  }, [fetchPakStatuses]);

  const downloadSections = useMemo(
    () =>
      downloadEntries.map((entry) => ({
        entry,
        groups: groupPakEntries(entry.contents),
      })),
    [downloadEntries]
  );

  const handleToggle = useCallback(
    async (downloadId: number, files: string[], willCheck: boolean) => {
      const toastId = `apply-toggle-${downloadId}`;
      let statusLookup: Record<
        number,
        Record<string, ApiPakVersionStatus>
      > | null = null;
      let appliedSuccessfully = false;
      try {
        setIsApplying(true);
        const current = new Set<string>(activeByDownload[downloadId] || []);
        if (willCheck) {
          files.forEach((file) => current.add(file));
        } else {
          files.forEach((file) => current.delete(file));
        }
        const activeList = Array.from(current);
        const basenameTargets = new Set(files.map((file) => toBasename(file)));

        // Optimistically reflect the toggle state so the UI stays in sync while the request runs
        setActiveByDownload((prev) => {
          const next: Record<number, string[]> = {
            ...prev,
            [downloadId]: activeList,
          };
          if (willCheck && basenameTargets.size > 0) {
            for (const [key, value] of Object.entries(prev)) {
              const otherId = Number(key);
              if (otherId === downloadId) continue;
              if (!Array.isArray(value) || value.length === 0) continue;
              const filtered = value.filter(
                (name) => !basenameTargets.has(toBasename(name))
              );
              if (filtered.length !== value.length) {
                next[otherId] = filtered;
              }
            }
          }
          return next;
        });

        setDownloadEntries((prev) =>
          prev.map((entry) => {
            if (entry.id === downloadId) {
              return { ...entry, active_paks: activeList };
            }
            if (willCheck && basenameTargets.size > 0) {
              const prevActive = Array.isArray(entry.active_paks)
                ? entry.active_paks
                : [];
              if (prevActive.length === 0) return entry;
              const filtered = prevActive.filter(
                (name) => !basenameTargets.has(toBasename(name))
              );
              if (filtered.length !== prevActive.length) {
                return { ...entry, active_paks: filtered };
              }
            }
            return entry;
          })
        );

        toast.loading("Applying...", { id: toastId });
        await setActivePaks(Number(downloadId), activeList);
        appliedSuccessfully = true;
        await scanActive();
        try {
          await refreshConflicts();
        } catch (refreshError) {
          console.warn("[mod-modal] refreshConflicts failed", refreshError);
        }
        const refreshed = await hydrateDownloads({ skipScan: true });
        setDownloadEntries(refreshed);
        setActiveByDownload(toActiveMap(refreshed));
        statusLookup = await fetchPakStatuses();
        toast.success(willCheck ? "Activated file" : "Deactivated file", {
          id: toastId,
          duration: 2000,
        });
      } catch (error) {
        toast.error((error as any)?.message || "Failed to apply");
        try {
          const fallback = await hydrateDownloads();
          setDownloadEntries(fallback);
          setActiveByDownload(toActiveMap(fallback));
          statusLookup = await fetchPakStatuses();
        } catch (err) {
          console.error("[mod-modal] failed to rehydrate downloads", err);
        }
      } finally {
        if (statusLookup) {
          setPakStatusByDownload(statusLookup);
        }
        setIsApplying(false);
        if (appliedSuccessfully) {
          onConflictStateChanged?.();
          // Trigger parent refresh to update mod list
          onRefresh?.();
        }
      }
    },
    [
      activeByDownload,
      fetchPakStatuses,
      hydrateDownloads,
      onConflictStateChanged,
    ]
  );

  const handleDeleteDownload = useCallback(
    async (entry: DownloadEntry): Promise<boolean> => {
      if (!entry) {
        return false;
      }
      if (isApplying && deletingDownloadId == null) {
        toast.warning("Please wait for the current operation to finish.");
        return false;
      }
      if (deletingDownloadId != null && deletingDownloadId !== entry.id) {
        toast.warning("Please wait for the current deletion to finish.");
        return false;
      }

      const downloadId = entry.id;
      const displayName = getDownloadDisplayName(entry);
      const toastId = `delete-download-${downloadId}`;
      setDeletingDownloadId(downloadId);
      setIsApplying(true);

      let success = false;
      try {
        // Step 1: Deactivate all active paks first if any are active
        const activePaks = activeByDownload[downloadId] ?? entry.active_paks ?? [];
        if (activePaks.length > 0) {
          toast.loading(`Deactivating ${displayName}…`, { id: toastId });
          try {
            await setActivePaks(downloadId, []);
            await scanActive();
            // Update local state to reflect deactivation
            setActiveByDownload((prev) => ({
              ...prev,
              [downloadId]: [],
            }));
            setDownloadEntries((prev) =>
              prev.map((e) =>
                e.id === downloadId ? { ...e, active_paks: [] } : e
              )
            );
          } catch (deactivateError) {
            console.warn(
              "[mod-modal] Failed to deactivate paks before deletion",
              deactivateError
            );
            // Continue with deletion even if deactivation fails
          }
        }

        // Step 2: Delete the mod
        toast.loading(`Deleting ${displayName}…`, { id: toastId });
        const backendModId =
          typeof mod?.backendModId === "number" &&
          Number.isFinite(mod.backendModId)
            ? mod.backendModId
            : undefined;
        await deleteLocalDownloads([downloadId], backendModId);
        await scanActive();
        try {
          await refreshConflicts();
        } catch (refreshError) {
          console.warn(
            "[mod-modal] refreshConflicts after delete failed",
            refreshError
          );
        }
        const refreshed = await hydrateDownloads({ skipScan: true });
        setDownloadEntries(refreshed);
        setActiveByDownload(toActiveMap(refreshed));
        const lookup = await fetchPakStatuses();
        setPakStatusByDownload(lookup);
        toast.success(`Deleted ${displayName}`, { id: toastId, duration: 2000 });
        onConflictStateChanged?.();
        onRefresh?.();
        success = true;
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : String(error ?? "Unknown error");
        toast.error(`Failed to delete ${displayName}: ${message}`, {
          id: toastId,
          duration: 4000,
        });
      } finally {
        setDeletingDownloadId(null);
        setIsApplying(false);
      }
      return success;
    },
    [
      activeByDownload,
      deletingDownloadId,
      fetchPakStatuses,
      hydrateDownloads,
      isApplying,
      mod?.backendModId,
      onConflictStateChanged,
      onRefresh,
    ]
  );

  const handleDeleteDialogChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }
      if (deletingDownloadId != null) {
        return;
      }
      setDeleteDialogEntry(null);
    },
    [deletingDownloadId]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialogEntry) {
      return;
    }
    const result = await handleDeleteDownload(deleteDialogEntry);
    if (result) {
      setDeleteDialogEntry(null);
    }
  }, [deleteDialogEntry, handleDeleteDownload]);

  if (!mod) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Stronger client-side sanitization using DOMPurify
  const sanitizeHtml = (html: string) =>
    DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

  const resolvedChangelogs: ApiChangelog[] = changelogs ?? [];

  const toChangelogHtml = (value?: string | null): string => {
    if (typeof value !== "string") {
      return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const hasBreakTag = /<\s*br\s*\/?\s*>/i.test(trimmed);
    const normalized = hasBreakTag
      ? trimmed
      : trimmed.replace(/\r?\n/g, "<br />");
    return sanitizeHtml(normalized);
  };

  const pendingDeleteLabel = deleteDialogEntry
    ? getDownloadDisplayName(deleteDialogEntry)
    : "";
  const pendingDeletePath = deleteDialogEntry?.path ?? "";
  const isDeletingSelectedEntry =
    deleteDialogEntry != null && deletingDownloadId === deleteDialogEntry.id;

  // Compute if any pak files are currently activated across all downloads
  const hasAnyActivePaks = useMemo(() => {
    return Object.values(activeByDownload).some(
      (activePaks) => Array.isArray(activePaks) && activePaks.length > 0
    );
  }, [activeByDownload]);

  // Comments tab removed per request

  // Note: we rely on local download contents for toggling, not Nexus file list.

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="!w-[1200px] !max-w-[95vw] !sm:max-w-[1200px] !md:max-w-[1200px] !lg:max-w-[1200px] !xl:max-w-[1200px] !h-[90vh] !max-h-[90vh] p-0 !flex !flex-col overflow-hidden !grid-none"
        style={{
          width: "1200px",
          maxWidth: "95vw",
          height: "90vh",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        aria-describedby="mod-dialog-description"
        showCloseButton={false}
      >
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* Hidden description for accessibility to satisfy aria-describedby */}
          <p id="mod-dialog-description" className="sr-only">
            Manage and apply mod files for {mod?.name}.
          </p>
          {/* Header */}
          <DialogHeader className="p-6 pb-4 flex-shrink-0">
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={details?.mod?.picture_url || mod.images[0]}
                  alt={mod.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const fallback =
                      "https://i.pinimg.com/1200x/44/da/5e/44da5e6d9dd75cb753ab5925aff4ce4c.jpg";
                    if (e.currentTarget.src !== fallback) {
                      e.currentTarget.src = fallback;
                    }
                  }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl mb-2">{mod.name}</DialogTitle>
                <p className="text-muted-foreground mb-3">
                  {details?.mod?.summary || mod.description}
                </p>

                <div className="flex items-center gap-3 mb-3">
                  <a
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={async () => {
                      const modUrl = `https://next.nexusmods.com/profile/${details?.mod?.author || mod.author || "unknown"}`;
                      try {
                        const { openInBrowser } = await import(
                          "../lib/tauri-utils"
                        );
                        await openInBrowser(modUrl);
                      } catch (error) {
                        console.error("Failed to open mod page:", error);
                      }
                    }}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarImage
                        src={mod.authorAvatar || undefined}
                        alt={mod.author || "Unknown author"}
                        referrerPolicy="no-referrer"
                        onError={(event: SyntheticEvent<HTMLImageElement>) => {
                          const img = event.currentTarget;
                          if (img.dataset.fallbackApplied === "1") {
                            return;
                          }
                          img.dataset.fallbackApplied = "1";
                          img.src = "";
                        }}
                      />
                      <AvatarFallback className="text-xs">
                        {(mod.author?.trim()?.[0] ?? "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {details?.mod?.author || mod.author || "Unknown author"}
                    </span>
                  </a>
                  {mod.categoryTags && mod.categoryTags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {mod.categoryTags.map((tag) => (
                        <Badge
                          key={`modal-category-${tag}`}
                          variant="secondary"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {serverModId && (
                    <div className="flex gap-1 flex-wrap bg-muted rounded-md px-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          const modUrl = `https://www.nexusmods.com/marvelrivals/mods/${serverModId}`;
                          try {
                            const { openInBrowser } = await import("../lib/tauri-utils");
                            await openInBrowser(modUrl);
                          } catch (error) {
                            console.error("Failed to open mod page:", error);
                          }
                        }}
                        className="h-6 w-6"
                        title="View on Nexus Mods"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Download className="w-6 h-4" />
                    {formatNumber(
                      (details?.mod?.mod_downloads as number | null) ??
                        mod.downloads ??
                        0
                    )}{" "}
                    downloads
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-6 h-4 fill-yellow-400 text-yellow-400" />
                    {details?.mod?.endorsement_count != null
                      ? `${details.mod.endorsement_count} endorsements`
                      : `${mod.rating.toFixed(1)} rating`}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-6 h-4" />
                    Updated{" "}
                    {formatDate(
                      details?.latest_file?.uploaded_at || mod.lastUpdated
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant={hasAnyActivePaks ? "secondary" : "default"}
                  onClick={() => onInstall(mod.id)}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  {hasAnyActivePaks ? "Installed" : "Not Installed"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onFavorite(mod.id)}
                  className={`gap-2 ${mod.isFavorited ? "text-red-500" : ""}`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      mod.isFavorited ? "fill-current" : ""
                    }`}
                  />
                  {mod.isFavorited ? "Favorited" : "Add to Favorites"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Separator className="flex-shrink-0" />

          {/* Content */}
          <div
            className="flex-1 min-h-0 overflow-hidden"
            style={{ height: "calc(100% - 200px)" }}
          >
            <Tabs
              defaultValue="overview"
              className="h-full flex flex-col overflow-hidden"
              style={{ height: "100%" }}
            >
              <TabsList className="mx-6 mt-4 mb-0 flex-shrink-0">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="changelog">Changelog</TabsTrigger>
              </TabsList>

              <div
                className="flex-1 min-h-0 overflow-hidden"
                style={{ height: "calc(100% - 52px)" }}
              >
                <TabsContent
                  value="overview"
                  className="!h-full m-0 data-[state=active]:!flex data-[state=active]:!flex-col data-[state=active]:!h-full overflow-hidden"
                  style={{ height: "100%" }}
                >
                  <ScrollArea
                    className="flex-1 min-h-0 overflow-auto"
                    style={{ height: "100%" }}
                  >
                    <div className="px-6 py-4">
                      <div className="space-y-6">
                        <div>
                          <h3 className="font-medium mb-3">Tags</h3>
                          {overviewTags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {overviewTags.map((tag) => (
                                <Badge
                                  key={`overview-tag-${tag}`}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              No tags available for this mod.
                            </p>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <h3 className="font-medium mb-3">Description</h3>
                          <div className="prose prose-sm max-w-none text-muted-foreground">
                            {details?.mod?.description ? (
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(
                                    details?.mod?.description || ""
                                  ),
                                }}
                              />
                            ) : details?.mod?.summary ? (
                              <p>{details?.mod?.summary}</p>
                            ) : (
                              <p className="italic">
                                No description available.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent
                  value="files"
                  className="!h-full m-0 data-[state=active]:!flex data-[state=active]:!flex-col data-[state=active]:!h-full overflow-hidden"
                  style={{ height: "100%" }}
                >
                  <ScrollArea
                    className="flex-1 min-h-0 overflow-auto"
                    style={{ height: "100%" }}
                  >
                    <div className="px-6 py-4">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <File className="w-5 h-5" />
                            Pak Files
                          </h3>
                        </div>

                        <div className="space-y-4">
                          {downloadSections.length === 0 && (
                            <div className="text-sm text-muted-foreground">
                              No local downloads recorded for this mod yet.
                            </div>
                          )}
                          {downloadSections.map(({ entry, groups }) => {
                            const activeList =
                              activeByDownload[entry.id] ??
                              entry.active_paks ??
                              [];
                            const isActive = activeList.length > 0;
                            const lower = (entry.path || "").toLowerCase();
                            // Allow activation for archives, single .pak files, and folders (extracted mods)
                            const isArchive =
                              lower.endsWith(".zip") ||
                              lower.endsWith(".rar") ||
                              lower.endsWith(".7z");
                            const isSinglePak = lower.endsWith(".pak");
                            // Assume it's a folder if it doesn't have a recognized file extension
                            const isFolder = !isArchive && !isSinglePak;
                            const canApply =
                              isArchive || isSinglePak || isFolder;
                            const switchDisabled =
                              isApplying ||
                              deletingDownloadId === entry.id ||
                              !canApply;
                            const statusMap =
                              pakStatusByDownload[entry.id] ?? {};
                            const statusValues = Object.values(statusMap);
                            const displayVersion = normalizeVersion(
                              statusValues.find(
                                (status) =>
                                  status.display_version &&
                                  status.display_version.trim() !== ""
                              )?.display_version || entry.version
                            );
                            const entryLabel = entry.name?.trim()
                              ? entry.name
                              : mod.name;
                            return (
                              <div
                                key={entry.id}
                                className={`border border-border rounded-xl p-4 space-y-3 transition-colors ${
                                  isActive
                                    ? "bg-green-50 dark:bg-green-950/40"
                                    : "bg-background"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                                    <h4 className="font-semibold text-base truncate">
                                      {entryLabel}
                                    </h4>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Version {displayVersion}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        isActive
                                          ? "border-green-600 text-green-600"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      {isActive ? "Active" : "Inactive"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (
                                          isApplying ||
                                          deletingDownloadId != null
                                        ) {
                                          return;
                                        }
                                        setDeleteDialogEntry(entry);
                                      }}
                                      disabled={
                                        isApplying ||
                                        deletingDownloadId === entry.id
                                      }
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      aria-label={`Delete ${entryLabel}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  {groups.length === 0 && (
                                    <div className="text-sm text-muted-foreground">
                                      No .pak files recorded for this download.
                                    </div>
                                  )}
                                  {groups.map(({ primary, files }) => {
                                    const checked = files.some((file) =>
                                      activeList.includes(file)
                                    );
                                    return (
                                      <div
                                        key={`${entry.id}-${primary}`}
                                        className={`border border-border rounded-lg p-4 transition-colors ${
                                          checked
                                            ? "bg-green-100 dark:bg-green-900/60"
                                            : "bg-popover"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-4">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <File className="w-4 h-4 text-muted-foreground" />
                                            <div className="min-w-0">
                                              <div className="font-medium truncate">
                                                {primary}
                                              </div>
                                            </div>
                                          </div>
                                          <Switch
                                            disabled={switchDisabled}
                                            checked={checked}
                                            onCheckedChange={(
                                              willCheck: boolean
                                            ) =>
                                              handleToggle(
                                                entry.id,
                                                files,
                                                willCheck
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent
                  value="changelog"
                  className="!h-full m-0 data-[state=active]:!flex data-[state=active]:!flex-col data-[state=active]:!h-full overflow-hidden"
                  style={{ height: "100%" }}
                >
                  <ScrollArea
                    className="flex-1 min-h-0 overflow-auto"
                    style={{ height: "100%" }}
                  >
                    <div className="px-6 py-4">
                      <div className="space-y-4">
                        {resolvedChangelogs.map((version) => {
                          const changelogHtml = toChangelogHtml(
                            version.changelog
                          );
                          return (
                            <div
                              key={`${version.version}-${version.uploaded_at}`}
                              className="border-l-2 border-muted pl-4"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium">
                                  Version {version.version}
                                </h4>
                                <Badge variant="outline" className="text-xs">
                                  {version.uploaded_at
                                    ? formatDate(version.uploaded_at)
                                    : ""}
                                </Badge>
                              </div>
                              {changelogHtml ? (
                                <div
                                  className="text-sm text-muted-foreground"
                                  dangerouslySetInnerHTML={{
                                    __html: changelogHtml,
                                  }}
                                />
                              ) : (
                                <div className="text-sm text-muted-foreground italic">
                                  No changelog details provided.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Comments tab removed per request */}
              </div>
            </Tabs>
          </div>
        </div>
        <div className="flex justify-end px-6 pb-6 pt-2">
          <DialogClose asChild>
            <Button
              variant="default"
              className="px-2 text-base font-semibold shadow-sm"
            >
              Close
            </Button>
          </DialogClose>
        </div>

        <AlertDialog
          open={deleteDialogEntry != null}
          onOpenChange={handleDeleteDialogChange}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {pendingDeleteLabel || "this download"}?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    This removes the archive or folder from disk and deletes its
                    entry from the RivalNxt database. This action cannot be
                    undone.
                  </p>
                  {pendingDeletePath ? (
                    <p className="text-muted-foreground break-all text-xs">
                      {pendingDeletePath}
                    </p>
                  ) : null}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingSelectedEntry}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeletingSelectedEntry}
              >
                {isDeletingSelectedEntry ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
