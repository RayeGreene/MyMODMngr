import { useEffect, useState } from "react";
import type { Mod } from "./ModCard";
import { InstalledModCard } from "./InstalledModCard";
import { SearchHeader } from "./SearchHeader";
import { ModModal } from "./ModModal";
import {
  categoriesMatchTag,
  extractNonCategoryTags,
} from "../lib/categoryUtils";

interface ActiveModsViewProps {
  mods: Mod[];
  onToggleMod: (modId: string) => void;
  onDisableAll: () => void;
  onEnableAll: () => void;
  onUpdate: (modId: string) => void | Promise<void>;
  onUninstall: (modId: string) => void | Promise<void>;
  onFavorite: (modId: string) => void;
  selectedCategory: string;
  selectedCharacters: string[];
  onConflictStateChanged?: () => void;
}

export function ActiveModsView({
  mods,
  onUpdate,
  onUninstall,
  onFavorite,
  selectedCategory,
  selectedCharacters,
  onConflictStateChanged,
}: ActiveModsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<string>("Recent");
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

  const installedMods = mods.filter((mod) => mod.isInstalled);
  let filteredMods = [...installedMods];

  // Filter by category
  if (selectedCategory && selectedCategory !== "all") {
    filteredMods = filteredMods.filter(
      (mod) =>
        (Array.isArray(mod.categoryTags) &&
          mod.categoryTags.includes(selectedCategory)) ||
        categoriesMatchTag(mod.tags, selectedCategory)
    );
  }

  // Filter by character (if any selected)
  if (selectedCharacters && selectedCharacters.length > 0) {
    filteredMods = filteredMods.filter((mod) => {
      const nonCategoryTags = extractNonCategoryTags(mod.tags);
      if (nonCategoryTags.length === 0) return false;
      return nonCategoryTags.some((tag) => selectedCharacters.includes(tag));
    });
  }

  // Filter by search
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredMods = filteredMods.filter(
      (mod) =>
        mod.name.toLowerCase().includes(query) ||
        mod.description.toLowerCase().includes(query) ||
        mod.author.toLowerCase().includes(query) ||
        mod.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  // Sort
  const MISSING_TIME = Number.MIN_SAFE_INTEGER;
  const toTimestamp = (value?: string | null) => {
    if (!value) return MISSING_TIME;
    const time = Date.parse(value);
    return Number.isNaN(time) ? MISSING_TIME : time;
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
  switch (sortBy) {
    case "Popular":
      filteredMods.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
      break;
    case "Recent":
      filteredMods.sort((a, b) =>
        compareSortKey(releaseSortKey(a), releaseSortKey(b))
      );
      break;
    case "Updated":
      filteredMods.sort((a, b) =>
        compareSortKey(updatedSortKey(a), updatedSortKey(b))
      );
      break;
    case "Rating":
      filteredMods.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "Downloads":
      filteredMods.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
      break;
    case "Performance":
      filteredMods.sort(
        (a, b) => (b.performanceImpact || 0) - (a.performanceImpact || 0)
      );
      break;
    case "Name":
      filteredMods.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "Category":
      filteredMods.sort((a, b) => {
        const categoryA = a.categoryTags?.[0] ?? a.category ?? "";
        const categoryB = b.categoryTags?.[0] ?? b.category ?? "";
        return categoryA.localeCompare(categoryB);
      });
      break;
    default:
      break;
  }

  // Separate active and inactive for display
  const filteredActiveMods = filteredMods.filter(
    (mod) => mod.isActive !== false
  );
  const filteredInactiveMods = filteredMods.filter(
    (mod) => mod.isActive === false
  );

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Search Header */}
        <SearchHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Content */}
        <style>{`
        .activemods-hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
        <div
          className="flex-1 overflow-auto activemods-hide-scrollbar"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            overflowY: "auto",
          }}
        >
          <div className="p-6">
            {/* Active Mods */}
            {filteredActiveMods.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4">
                  Active Mods ({filteredActiveMods.length})
                </h2>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                      : "flex flex-col gap-4"
                  }
                >
                  {filteredActiveMods.map((mod) => (
                    <InstalledModCard
                      key={mod.backendModId ?? mod.id}
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
              </div>
            )}

            {/* Disabled Mods */}
            {filteredInactiveMods.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Disabled Mods ({filteredInactiveMods.length})
                </h2>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 opacity-60"
                      : "flex flex-col gap-4 opacity-60"
                  }
                >
                  {filteredInactiveMods.map((mod) => (
                    <InstalledModCard
                      key={mod.backendModId ?? mod.id}
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
              </div>
            )}

            {/* Empty State */}
            {filteredMods.length === 0 && (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium mb-2">No mods found</h3>
                <p className="text-muted-foreground">
                  {installedMods.length === 0
                    ? "No mods installed yet."
                    : "Try adjusting your search criteria."}
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
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMod(null);
          }}
          onInstall={() => {}}
          onFavorite={onFavorite}
          onConflictStateChanged={onConflictStateChanged}
        />
      )}
    </>
  );
}
