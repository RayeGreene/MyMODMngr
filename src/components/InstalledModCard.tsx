import { useState, type SyntheticEvent } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
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
  Trash2,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Heart,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import type { Mod } from "./ModCard";
import { computeTagDisplay } from "../lib/tagDisplay";
import TagList from "./TagList";

interface InstalledModCardProps {
  mod: Mod;
  viewMode: "grid" | "list";
  onUninstall: (modId: string) => void | Promise<void>;
  onUpdate: (modId: string) => void | Promise<void>;
  onView: (mod: Mod) => void;
  onFavorite: (modId: string) => void;
}

export function InstalledModCard({
  mod,
  viewMode,
  onUninstall,
  onUpdate,
  onView,
  onFavorite,
}: InstalledModCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const debugCards =
    typeof window !== "undefined" &&
    window.localStorage.getItem("mm-debug-cards") === "1";
  const { visible: displayTags } = computeTagDisplay(
    mod.tags,
    mod.categoryTags?.[0] ?? mod.category
  );

  // Use lightweight TagList to avoid expensive per-resize measurements.
  // TagList shows up to `maxVisible` tags (default 3) and a simple +N badge.
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const fallbackAvatarSrc =
    mod.authorMemberId != null
      ? `https://avatars.nexusmods.com/${mod.authorMemberId}/100`
      : undefined;
  const pngAvatarSrc =
    mod.authorMemberId != null
      ? `https://avatars.nexusmods.com/${mod.authorMemberId}/100.png`
      : undefined;

  const avatarCandidates = Array.from(
    new Set(
      [mod.authorAvatar, fallbackAvatarSrc, pngAvatarSrc].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  if (typeof window !== "undefined") {
    console.debug("[avatar] InstalledModCard candidates", {
      modId: mod.id,
      name: mod.name,
      candidates: avatarCandidates,
    });
  }

  const authorAvatarSrc = avatarCandidates[0];

  const handleConfirmUninstall = async () => {
    setIsUninstalling(true);
    try {
      await Promise.resolve(onUninstall(mod.id));
      setConfirmOpen(false);
    } catch (error) {
      console.warn("[InstalledModCard] uninstall failed", error);
    } finally {
      setIsUninstalling(false);
    }
  };

  const confirmDialog = (
    <AlertDialog
      open={confirmOpen}
      onOpenChange={(open) => {
        if (!open && !isUninstalling) {
          setConfirmOpen(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {mod.name || "this mod"}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the mod's local downloads and disconnects it from the
            manager. You can re-install it later from Nexus.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUninstalling}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmUninstall}
            disabled={isUninstalling}
          >
            {isUninstalling ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (viewMode === "list") {
    return (
      <>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex gap-4 flex-wrap sm:flex-nowrap">
              <div
                className="w-20 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0 relative cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`Open ${mod.name} details`}
                onClick={() => onView(mod)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onView(mod);
                  }
                }}
              >
                <img
                  src={mod.images[0]}
                  alt={mod.name}
                  className="w-full h-full object-cover"
                />
                {(mod.hasUpdate || mod.isUpdating) && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                    {mod.isUpdating ? (
                      <RefreshCw className="w-2 h-2 text-destructive-foreground animate-spin" />
                    ) : (
                      <AlertTriangle className="w-2 h-2 text-destructive-foreground" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 w-full">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3
                        className="font-medium truncate cursor-pointer hover:text-primary"
                        onClick={() => onView(mod)}
                      >
                        {mod.name}
                      </h3>
                      {mod.hasUpdate && (
                        <Badge
                          variant="destructive"
                          className="text-xs shrink-0"
                        >
                          Update Available
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                      {mod.description}
                    </p>

                    <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1 shrink-0">
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">
                          {mod.author}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Calendar className="w-3 h-3" />
                        Installed{" "}
                        {formatDate(mod.installDate || mod.lastUpdated)}
                      </div>
                      {mod.isActive && (
                        <div className="flex items-center gap-1 shrink-0">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          Active
                        </div>
                      )}
                    </div>
                  </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                      <TagList
                        tags={displayTags}
                        className="flex items-center gap-1 overflow-hidden flex-nowrap"
                        maxVisible={3}
                      />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFavorite(mod.id)}
                      className={mod.isFavorited ? "text-red-500" : ""}
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          mod.isFavorited ? "fill-current" : ""
                        }`}
                      />
                    </Button>

                    {(mod.hasUpdate || mod.isUpdating) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdate(mod.id)}
                        className="gap-1 shrink-0"
                        disabled={mod.isUpdating}
                        aria-disabled={mod.isUpdating}
                      >
                        <RefreshCw
                          className={`w-3 h-3${
                            mod.isUpdating ? " animate-spin" : ""
                          }`}
                        />
                        {mod.isUpdating ? "Updating…" : "Update"}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmOpen(true)}
                      disabled={isUninstalling}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <Card className="hover:shadow-lg dark:hover:shadow-white transition-all duration-200 group relative">
        <CardContent className="p-0 min-h-[370px] flex flex-col flex-1">
          <div
            className="aspect-video bg-muted relative overflow-hidden rounded-t-lg cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`Open ${mod.name} details`}
            onClick={() => onView(mod)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onView(mod);
              }
            }}
          >
            <img
              src={mod.images[0]}
              alt={mod.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />

            {(mod.hasUpdate || mod.isUpdating) && (
              <div className="absolute top-2 left-2 bg-destructive text-destructive-foreground px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                {mod.isUpdating ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {mod.isUpdating ? "Updating…" : "Update Available"}
              </div>
            )}

            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(ev) => {
                    // prevent parent handler from double-firing
                    ev.stopPropagation();
                    onView(mod);
                  }}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View
                </Button>
              </div>
            </div>
          </div>

          <div
            className="flex flex-col flex-1 h-full"
            style={{ padding: "10px 6px 16px 16px" }}
          >
            <div className="flex-1 flex flex-col justify-between h-full">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-medium mb-1 cursor-pointer hover:text-primary line-clamp-1"
                      onClick={() => onView(mod)}
                    >
                      {mod.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {mod.isActive && (
                        <>
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span>Active</span>
                          <span>•</span>
                        </>
                      )}
                      <span>
                        {formatDate(mod.installDate || mod.lastUpdated)}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFavorite(mod.id)}
                    className={mod.isFavorited ? "text-red-500" : ""}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        mod.isFavorited ? "fill-current" : ""
                      }`}
                    />
                  </Button>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Avatar className="w-6 h-6">
                    <AvatarImage
                      src={authorAvatarSrc}
                      alt={mod.author || "Unknown author"}
                      referrerPolicy="no-referrer"
                      data-avatar-index="0"
                      data-avatar-candidates={avatarCandidates.join("|")}
                      onError={(event: SyntheticEvent<HTMLImageElement>) => {
                        const img = event.currentTarget;
                        const candidates = (img.dataset.avatarCandidates || "")
                          .split("|")
                          .filter(Boolean);
                        const currentIndex = Number(
                          img.dataset.avatarIndex || "0"
                        );
                        const nextIndex = currentIndex + 1;
                        if (nextIndex < candidates.length) {
                          const nextSrc = candidates[nextIndex];
                          img.dataset.avatarIndex = String(nextIndex);
                          if (typeof window !== "undefined") {
                            console.warn(
                              "[avatar] fallback to next candidate",
                              {
                                modId: mod.id,
                                name: mod.name,
                                attempted: img.src,
                                nextSrc,
                                nextIndex,
                              }
                            );
                          }
                          img.src = nextSrc;
                          return;
                        }
                        if (typeof window !== "undefined") {
                          console.error(
                            "[avatar] all avatar candidates failed",
                            {
                              modId: mod.id,
                              name: mod.name,
                              candidates,
                            }
                          );
                        }
                        img.dataset.avatarIndex = String(candidates.length);
                        img.src = "";
                      }}
                    />
                    <AvatarFallback className="text-xs">
                      {(mod.author?.trim()?.[0] ?? "?").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    {mod.author || "Unknown author"}
                  </span>
                </div>

                <TagList
                  tags={displayTags}
                  className="flex items-center gap-1 mb-2 overflow-hidden flex-nowrap"
                  maxVisible={3}
                />
                {debugCards && (
                  <div className="text-[10px] text-muted-foreground border rounded p-1">
                    <div>
                      <strong>category tags:</strong>{" "}
                      {(mod.categoryTags && mod.categoryTags.length > 0
                        ? mod.categoryTags.join(", ")
                        : mod.category) || "(none)"}
                    </div>
                    <div>
                      <strong>tags:</strong> {mod.tags.join(", ")}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                {mod.hasUpdate || mod.isUpdating ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onUpdate(mod.id)}
                    className="flex-1 gap-2"
                    disabled={mod.isUpdating}
                    aria-disabled={mod.isUpdating}
                  >
                    <RefreshCw
                      className={`w-3 h-3${
                        mod.isUpdating ? " animate-spin" : ""
                      }`}
                    />
                    {mod.isUpdating ? "Updating…" : "Update"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 pointer-events-none"
                    asChild
                  >
                    <div>
                      <CheckCircle className="w-3 h-3" />
                      Up to date
                    </div>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setConfirmOpen(true);
                  }}
                  disabled={isUninstalling}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {mod.updateError && (
                <div className="mt-2 text-xs text-destructive">
                  {mod.updateError}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {confirmDialog}
    </>
  );
}
