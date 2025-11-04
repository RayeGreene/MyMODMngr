import type { SyntheticEvent } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Download, Star, Eye, Calendar, User, Heart } from "lucide-react";
import { computeTagDisplay } from "../lib/tagDisplay";

export interface Mod {
  id: string;
  backendModId?: number | null; // server-side mods.mod_id if available
  // Aggregated local download ids that belong to this mod card (used for activation toggles)
  sourceDownloadIds?: number[];
  // Aggregated active paks across the grouped downloads (used to seed UI)
  defaultActivePaks?: string[];
  name: string;
  description: string;
  author: string;
  authorAvatar?: string;
  authorMemberId?: number;
  authorProfileUrl?: string;
  category: string;
  categoryTags?: string[];
  character?: string; // New field for character filtering
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
  isActive?: boolean; // New field for active/inactive status
  performanceImpact?: number; // 1-5 scale for performance impact
  needsUpdate?: boolean;
  isUpdating?: boolean;
  updateError?: string | null;
}

interface ModCardProps {
  mod: Mod;
  viewMode: "grid" | "list";
  onInstall: (modId: string) => void;
  onFavorite: (modId: string) => void;
  onView: (mod: Mod) => void;
}

export function ModCard({
  mod,
  viewMode,
  onInstall,
  onFavorite,
  onView,
}: ModCardProps) {
  // const [imageLoaded, setImageLoaded] = useState(false);

  const { visible: displayTags, extra: hiddenTagCount } = computeTagDisplay(
    mod.tags,
    mod.categoryTags?.[0] ?? mod.category
  );

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
    console.debug("[avatar] ModCard candidates", {
      modId: mod.id,
      name: mod.name,
      candidates: avatarCandidates,
    });
  }

  const authorAvatarSrc = avatarCandidates[0];

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (viewMode === "list") {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="w-20 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={mod.images[0]}
                alt={mod.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3
                    className="font-medium truncate cursor-pointer hover:text-primary"
                    onClick={() => onView(mod)}
                  >
                    {mod.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {mod.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {mod.author}
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {formatNumber(mod.downloads)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      {mod.rating.toFixed(1)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(mod.lastUpdated)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <div className="flex items-center gap-1 overflow-hidden flex-nowrap">
                    {displayTags.map((tag) => (
                      <Badge
                        key={`tag-${mod.id}-${tag}`}
                        variant="secondary"
                        className="text-xs whitespace-nowrap"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {hiddenTagCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs whitespace-nowrap"
                      >
                        +{hiddenTagCount}
                      </Badge>
                    )}
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-all duration-200 group">
      <CardContent className="p-0">
        <div className="aspect-video bg-muted relative overflow-hidden rounded-t-lg">
          <img
            src={mod.images[0]}
            alt={mod.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onView(mod)}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              View Details
            </Button>
          </div>
          {/* No main category badge; rely on tag list */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFavorite(mod.id)}
            className={`absolute top-2 right-2 ${
              mod.isFavorited ? "text-red-500" : "text-white"
            }`}
          >
            <Heart
              className={`w-4 h-4 ${mod.isFavorited ? "fill-current" : ""}`}
            />
          </Button>
        </div>

        <div className="p-4">
          <h3
            className="font-medium mb-1 cursor-pointer hover:text-primary"
            onClick={() => onView(mod)}
          >
            {mod.name}
          </h3>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {mod.description}
          </p>

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
                    if (typeof window !== "undefined") {
                      console.warn("[avatar] fallback to next candidate", {
                        modId: mod.id,
                        name: mod.name,
                        attempted: img.src,
                        nextSrc,
                        nextIndex,
                      });
                    }
                    img.src = nextSrc;
                    return;
                  }
                  if (typeof window !== "undefined") {
                    console.error("[avatar] all avatar candidates failed", {
                      modId: mod.id,
                      name: mod.name,
                      candidates,
                    });
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

          <div className="flex items-center gap-1 mb-3 overflow-hidden flex-nowrap">
            {displayTags.map((tag) => (
              <Badge
                key={`tag-${mod.id}-${tag}`}
                variant="secondary"
                className="text-xs whitespace-nowrap"
              >
                {tag}
              </Badge>
            ))}
            {hiddenTagCount > 0 && (
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                +{hiddenTagCount}
              </Badge>
            )}
          </div>

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
