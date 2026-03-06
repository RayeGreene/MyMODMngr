import React, { useMemo } from "react";
import type { SyntheticEvent } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Download, Star, Eye, Heart, CheckCircle } from "lucide-react";
import TagList from "./TagList";
import { useNsfwFilter } from "./NSFWFilterProvider";

export interface Mod {
  id: string;
  backendModId?: number | null;
  sourceDownloadIds?: number[];
  defaultActivePaks?: string[];
  name: string;
  description: string;
  author: string;
  authorAvatar?: string;
  authorMemberId?: number;
  authorProfileUrl?: string;
  category: string;
  categoryTags?: string[];
  character?: string;
  tags: string[];
  downloads: number;
  rating: number;
  images: string[];
  version: string;
  lastUpdated: string;
  lastUpdatedRaw?: string | null;
  releaseDate?: string | null;
  hasInstallDate?: boolean;
  hasUpdateTimestamp?: boolean;
  isInstalled?: boolean;
  isFavorited?: boolean;
  hasUpdate?: boolean;
  installedVersion?: string;
  latestVersion?: string;
  latestVersionKey?: string | null;
  localVersionKey?: string | null;
  latestUploadedAt?: string | null;
  latestFileId?: number | null;
  latestFileName?: string | null;
  installDate?: string | null;
  isActive?: boolean;
  performanceImpact?: number;
  needsUpdate?: boolean;
  isUpdating?: boolean;
  updateError?: string | null;
  source?: string | null;
  isPremium?: boolean;
  extraPakCount?: number | null;
  premiumPakCount?: number | null;
  sharedPakCount?: number | null;
  containsAdultContent?: boolean;
  /** Whether this card is selected for bulk operations */
  isSelected?: boolean;
}

interface ModCardProps {
  mod: Mod;
  viewMode: "grid" | "list";
  onInstall: (modId: string) => void;
  onFavorite: (modId: string) => void;
  onView: (mod: Mod) => void;
  /** Bulk selection callback */
  onSelect?: (modId: string) => void;
  /** Whether bulk selection mode is active */
  selectionMode?: boolean;
}

function ModCardInner({
  mod,
  viewMode,
  onInstall,
  onFavorite,
  onView,
  onSelect,
  selectionMode,
}: ModCardProps) {
  const { nsfwBlurEnabled } = useNsfwFilter();
  const shouldBlur = mod.containsAdultContent && nsfwBlurEnabled;

  const { avatarCandidates, authorAvatarSrc } = useMemo(() => {
    const fallbackAvatarSrc =
      mod.authorMemberId != null
        ? `https://avatars.nexusmods.com/${mod.authorMemberId}/100`
        : undefined;
    const pngAvatarSrc =
      mod.authorMemberId != null
        ? `https://avatars.nexusmods.com/${mod.authorMemberId}/100.png`
        : undefined;
    const candidates = Array.from(
      new Set(
        [mod.authorAvatar, fallbackAvatarSrc, pngAvatarSrc].filter(
          (v): v is string => Boolean(v),
        ),
      ),
    );
    return { avatarCandidates: candidates, authorAvatarSrc: candidates[0] };
  }, [mod.authorAvatar, mod.authorMemberId]);

  const formatNumber = useMemo(() => {
    return (num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
      if (num >= 1000) return (num / 1000).toFixed(1) + "K";
      return num.toString();
    };
  }, []);

  const formatDate = useMemo(() => {
    return (dateString?: string | null) => {
      if (!dateString) return "Unknown";
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return "Unknown";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };
  }, []);

  if (viewMode === "list") {
    return (
      <div
        className={`hover:bg-muted/50 transition-colors border-b border-border/20 last:border-b-0 py-1 ${
          mod.isSelected ? "bg-primary/10 border-primary/30" : ""
        }`}
      >
        <div className="p-2">
          <div className="flex gap-3">
            {/* Bulk select checkbox */}
            {selectionMode && (
              <div className="flex items-center px-1">
                <button
                  type="button"
                  onClick={() => onSelect?.(mod.id)}
                  className={`w-4 h-4 rounded border-2 transition-colors flex items-center justify-center ${
                    mod.isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/40 hover:border-primary"
                  }`}
                  aria-label={mod.isSelected ? "Deselect" : "Select"}
                >
                  {mod.isSelected && (
                    <CheckCircle className="w-3 h-3 text-primary-foreground" />
                  )}
                </button>
              </div>
            )}

            <div className="p-1">
              <div className="w-8 h-8 bg-muted rounded-lg overflow-hidden flex-shrink-0 relative">
                <img
                  src={mod.images[0]}
                  alt={mod.name}
                  className="w-full h-full object-cover"
                  style={shouldBlur ? { filter: "blur(4px)" } : undefined}
                />
                {shouldBlur && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="text-[6px] font-bold text-white/80">
                      18+
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3
                    className="font-normal truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => onView(mod)}
                  >
                    {mod.name}
                    {mod.isPremium && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500 text-white align-middle">
                        PREMIUM{mod.extraPakCount != null && mod.extraPakCount > 0 ? ` +${mod.extraPakCount}` : ""}
                      </span>
                    )}
                  </h3>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <TagList tags={mod.tags} />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFavorite(mod.id)}
                    className={`transition-colors ${mod.isFavorited ? "text-red-500" : ""}`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        mod.isFavorited ? "fill-current" : ""
                      }`}
                    />
                  </Button>

                  <Button
                    variant={mod.isInstalled ? "secondary" : "default"}
                    size="sm"
                    onClick={() => onInstall(mod.id)}
                    className="gap-1"
                  >
                    <Download className="w-3 h-3" />
                    {mod.isInstalled ? "Installed" : "Install"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card
      className={`card-hover transition-all duration-200 group relative border ${
        mod.isSelected
          ? "ring-2 ring-primary border-primary/50"
          : "border-border/50 hover:border-primary/30"
      }`}
    >
      <CardContent className="p-0">
        {/* Selection checkbox overlay */}
        {selectionMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(mod.id);
            }}
            className={`absolute top-2 left-2 z-20 w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
              mod.isSelected
                ? "bg-primary border-primary shadow-md"
                : "border-white/70 bg-black/20 hover:border-primary hover:bg-primary/20"
            }`}
            aria-label={mod.isSelected ? "Deselect" : "Select"}
          >
            {mod.isSelected && (
              <CheckCircle className="w-3.5 h-3.5 text-primary-foreground" />
            )}
          </button>
        )}

        <div className="aspect-video bg-muted relative overflow-hidden rounded-t-lg">
          <img
            src={mod.images[0]}
            alt={mod.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={shouldBlur ? { filter: "blur(20px)" } : undefined}
          />
          {shouldBlur && (
            <div className="absolute top-2 right-2 pointer-events-none z-10">
              <span
                className="text-xs font-bold text-white px-2 py-0.5 rounded"
                style={{ backgroundColor: "#e84545" }}
              >
                NSFW
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onView(mod)}
              className="gap-2 shadow-lg"
            >
              <Eye className="w-4 h-4" />
              View Details
            </Button>
          </div>
          {mod.isPremium && (
            <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-semibold rounded bg-amber-500 text-white shadow-md">
              PREMIUM
              {mod.extraPakCount != null && mod.extraPakCount > 0 && (
                <span className="ml-1 opacity-80">+{mod.extraPakCount} PAK{mod.extraPakCount > 1 ? "s" : ""}</span>
              )}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFavorite(mod.id)}
            className={`absolute top-2 right-2 transition-all ${
              mod.isFavorited ? "text-red-500" : "text-white hover:text-red-400"
            }`}
          >
            <Heart
              className={`w-4 h-4 ${mod.isFavorited ? "fill-current" : ""}`}
            />
          </Button>
        </div>

        <div className="p-4">
          <h3
            className="font-medium mb-1 cursor-pointer hover:text-primary transition-colors line-clamp-1"
            onClick={() => onView(mod)}
          >
            {mod.name}
          </h3>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {mod.description}
          </p>

          {mod.backendModId != null && mod.backendModId > 0 && (
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
                    const currentIndex = Number(img.dataset.avatarIndex || "0");
                    const nextIndex = currentIndex + 1;
                    if (nextIndex < candidates.length) {
                      const nextSrc = candidates[nextIndex];
                      img.dataset.avatarIndex = String(nextIndex);
                      img.src = nextSrc;
                      return;
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
          )}

          <TagList tags={mod.tags} className="mb-3" />

          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {formatNumber(mod.downloads)}
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {mod.rating.toFixed(1)}
              </div>
            </div>
            <span>{formatDate(mod.lastUpdated)}</span>
          </div>

          <Button
            variant={mod.isInstalled ? "secondary" : "default"}
            size="sm"
            onClick={() => onInstall(mod.id)}
            className="w-full gap-2"
          >
            <Download className="w-4 h-4" />
            {mod.isInstalled ? "Installed" : "Install"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function modPropsAreEqual(prev: ModCardProps, next: ModCardProps) {
  const a = prev.mod;
  const b = next.mod;
  if (a.id !== b.id) return false;
  const keys: (keyof Mod)[] = [
    "isInstalled",
    "isFavorited",
    "hasUpdate",
    "isUpdating",
    "isActive",
    "isSelected",
    "downloads",
    "rating",
    "name",
    "description",
    "latestVersion",
  ];
  for (const k of keys) {
    // @ts-ignore - index by dynamic key
    if (a[k] !== b[k]) return false;
  }
  if (prev.viewMode !== next.viewMode) return false;
  if (prev.selectionMode !== next.selectionMode) return false;
  return true;
}

export const ModCard = React.memo(ModCardInner, modPropsAreEqual);
