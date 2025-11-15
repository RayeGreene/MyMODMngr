import { useEffect, useState } from "react";
import type { Mod } from "./ModCard";
import { InstalledModCard } from "./InstalledModCard";
import { SearchHeader } from "./SearchHeader";
import { ModModal } from "./ModModal";
import {
  categoriesMatchTag,
  extractNonCategoryTags,
} from "../lib/categoryUtils";

interface DownloadsPageProps {
  mods: Mod[];
  onUpdate: (modId: string) => void | Promise<void>;
  onUninstall: (modId: string) => void | Promise<void>;
  onFavorite: (modId: string) => void;
  selectedCategory: string;
  selectedCharacters: string[];
  onModAdded?: () => Promise<void> | void;
  onConflictStateChanged?: () => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

export function DownloadsPage({
  mods,
  onUpdate,
  onUninstall,
  onFavorite,
  selectedCategory,
  selectedCharacters,
  onModAdded,
  onConflictStateChanged,
  viewMode,
  onViewModeChange,
}: DownloadsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("Recent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!selectedMod) return;
    const updated = mods.find((mod) => {
      if (
        selectedMod.backendModId != null &&
        mod.backendModId != null &&
        mod.backendModId === selectedMod.backendModId
      ) {
        return true;
      }
      return mod.id === selectedMod.id;
    });
    if (!updated) {
      setSelectedMod(null);
      setIsModalOpen(false);
      return;
    }
    if (updated !== selectedMod) {
      setSelectedMod(updated);
    }
  }, [mods, selectedMod]);

  // Base: show only installed mods
  let filteredMods = mods.filter((mod) => mod.isInstalled);

  // Filter by category
  if (selectedCategory && selectedCategory !== "all") {
    filteredMods = filteredMods.filter(
      (mod) =>
        (Array.isArray(mod.categoryTags) &&
          mod.categoryTags.includes(selectedCategory)) ||
        categoriesMatchTag(mod.tags, selectedCategory)
    );
  }

  // Filter by character using canonical tags (match any non-category tag)
  if (selectedCharacters && selectedCharacters.length > 0) {
    filteredMods = filteredMods.filter((mod) => {
      const characterTags = extractNonCategoryTags(mod.tags);
      if (characterTags.length === 0) return false;
      return characterTags.some((tag) => selectedCharacters.includes(tag));
    });
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredMods = filteredMods.filter(
      (mod) =>
        mod.name.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        mod.author.toLowerCase().includes(q) ||
        mod.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  // Sorting
  const MISSING_TIME = Number.MIN_SAFE_INTEGER;
  const toTimestamp = (value?: string | null) => {
    if (!value) return MISSING_TIME;
    const time = Date.parse(value);
    return Number.isNaN(time) ? MISSING_TIME : time;
  };
  const toNullableTimestamp = (value?: string | null): number | null => {
    if (!value) return null;
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
  };
  const hasApiSource = (mod: Mod) => mod.backendModId != null;
  const releaseSortKey = (mod: Mod) => {
    const release = toTimestamp(mod.releaseDate);
    const install = toTimestamp(mod.installDate);
    const hasInstall = mod.hasInstallDate ?? install !== MISSING_TIME;
    const hasUpdate = mod.hasUpdateTimestamp ?? Boolean(mod.lastUpdatedRaw);
    const timestamp =
      release !== MISSING_TIME ? release : hasInstall ? install : MISSING_TIME;
    const hasData = hasApiSource(mod) && hasInstall && hasUpdate;
    return { priority: hasData ? 1 : 0, timestamp };
  };
  const updatedSortKey = (mod: Mod) => {
    const updated = toTimestamp(mod.lastUpdatedRaw);
    const install = toTimestamp(mod.installDate);
    const hasInstall = mod.hasInstallDate ?? install !== MISSING_TIME;
    const hasUpdate = mod.hasUpdateTimestamp ?? updated !== MISSING_TIME;
    const timestamp = hasUpdate ? updated : hasInstall ? install : MISSING_TIME;
    const hasData = hasApiSource(mod) && hasUpdate && hasInstall;
    return { priority: hasData ? 1 : 0, timestamp };
  };
  const compareSortKey = (
    a: { priority: number; timestamp: number },
    b: { priority: number; timestamp: number }
  ) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    return 0;
  };
  const applyOrder = (val: number) => (sortOrder === "asc" ? -val : val);

  // Comparator factory for nullable timestamps that must place NULLs last
  const makeTimestampComparator = (
    getter: (m: Mod) => number | null
  ) => {
    return (a: Mod, b: Mod) => {
      const ta = getter(a);
      const tb = getter(b);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1; // a after b
      if (tb == null) return -1; // a before b
      if (ta === tb) return 0;
      return sortOrder === "asc" ? ta - tb : tb - ta;
    };
  };

  switch (sortBy) {
    case "Popular":
      filteredMods.sort((a, b) => applyOrder((b.downloads || 0) - (a.downloads || 0)));
      break;
    case "Recent":
      // Sort by local_downloads.created_at (mapped to installDate)
      filteredMods.sort(
        makeTimestampComparator((m) => toNullableTimestamp(m.installDate))
      );
      break;
    case "Updated":
      // Sort by mods.updated_at (mapped to lastUpdatedRaw / lastUpdated); NULLs always last
      filteredMods.sort(
        makeTimestampComparator((m) =>
          toNullableTimestamp(m.lastUpdatedRaw ?? m.lastUpdated ?? null)
        )
      );
      break;
    case "Rating":
      filteredMods.sort((a, b) => applyOrder((b.rating || 0) - (a.rating || 0)));
      break;
    case "Downloads":
      filteredMods.sort((a, b) => applyOrder((b.downloads || 0) - (a.downloads || 0)));
      break;
    case "Performance":
      filteredMods.sort(
        (a, b) => applyOrder((b.performanceImpact || 0) - (a.performanceImpact || 0))
      );
      break;
    case "Name":
      filteredMods.sort((a, b) => applyOrder(a.name.localeCompare(b.name)));
      break;
    case "Category":
      filteredMods.sort((a, b) => {
        const categoryA = a.categoryTags?.[0] ?? a.category ?? "";
        const categoryB = b.categoryTags?.[0] ?? b.category ?? "";
        return applyOrder(categoryA.localeCompare(categoryB));
      });
      break;
    default:
      break;
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Search & view controls */}
        <SearchHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          sortBy={sortBy}
          onSortChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          onModAdded={onModAdded}
        />

        {/* Mods grid/list */}
        <style>{`.custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(100, 100, 100, 0.5);
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 100, 100, 0.7);
          }
          .custom-scrollbar {
            scrollbar-color: rgba(100, 100, 100, 0.5) transparent;
            scrollbar-width: thin;
          }`}</style>
        <div
          className="flex-1 overflow-auto custom-scrollbar"
          style={{
            overflowY: "auto",
          }}
        >
          <div className="p-6">
            {filteredMods.length > 0 ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    : "flex flex-col gap-0"
                }
              >
                {filteredMods.map((mod) => (
                  <InstalledModCard
                    key={`mod-${mod.backendModId ?? mod.id}`}
                    mod={mod}
                    viewMode={viewMode}
                    onUninstall={onUninstall}
                    onUpdate={onUpdate}
                    onView={(m) => {
                      setSelectedMod(m);
                      setIsModalOpen(true);
                    }}
                    onFavorite={onFavorite}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium mb-2">No mods found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or search.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {selectedMod && (
        <ModModal
          mod={selectedMod}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onInstall={() => {}}
          onFavorite={onFavorite}
          onConflictStateChanged={onConflictStateChanged}
        />
      )}
    </>
  );
}
