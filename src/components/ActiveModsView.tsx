import { useEffect, useState } from "react";
import type { Mod } from "./ModCard";
import { InstalledModCard } from "./InstalledModCard";
import { SearchHeader } from "./SearchHeader";
import { ModModal } from "./ModModal";
import { BulkOperationsToolbar } from "./BulkOperationsToolbar";
import { Button } from "./ui/button";
import { toast } from "sonner";
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
  onCheckUpdate: (modId: string) => void | Promise<void>;
  onUninstall: (modId: string) => void | Promise<void>;
  onFavorite: (modId: string) => void;
  selectedCategory: string;
  selectedCharacters: string[];
  onConflictStateChanged?: () => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onRefresh?: () => void;
}

export function ActiveModsView({
  mods,
  onUpdate,
  onCheckUpdate,
  onUninstall,
  onFavorite,
  selectedCategory,
  selectedCharacters,
  onConflictStateChanged,
  viewMode,
  onViewModeChange,
  onRefresh,
}: ActiveModsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("Recent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        categoriesMatchTag(mod.tags, selectedCategory),
    );
  }

  // Smart hierarchical filtering: separate character tags from skin tags
  if (selectedCharacters && selectedCharacters.length > 0) {
    filteredMods = filteredMods.filter((mod) => {
      const nonCategoryTags = extractNonCategoryTags(mod.tags);
      if (nonCategoryTags.length === 0) return false;
      const modCharacter = nonCategoryTags[0];
      const modSkins = nonCategoryTags.slice(1);
      const matchesCharacter = selectedCharacters.includes(modCharacter);
      const matchingSkins = selectedCharacters.filter((tag) =>
        modSkins.includes(tag),
      );

      if (matchesCharacter) {
        if (matchingSkins.length > 0) {
          return true;
        }
        const hasAnySkinSelection = selectedCharacters.some(
          (tag) =>
            !nonCategoryTags.includes(tag) || nonCategoryTags.indexOf(tag) > 0,
        );
        return !hasAnySkinSelection || matchingSkins.length > 0;
      }

      return false;
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
        mod.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  // Sort
  const toNullableTimestamp = (value?: string | null): number | null => {
    if (!value) return null;
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : time;
  };
  const applyOrder = (val: number) => (sortOrder === "asc" ? -val : val);

  const makeTimestampComparator = (getter: (m: Mod) => number | null) => {
    return (a: Mod, b: Mod) => {
      const ta = getter(a);
      const tb = getter(b);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      if (ta === tb) return 0;
      return sortOrder === "asc" ? ta - tb : tb - ta;
    };
  };

  switch (sortBy) {
    case "Popular":
      filteredMods.sort((a, b) =>
        applyOrder((b.downloads || 0) - (a.downloads || 0)),
      );
      break;
    case "Recent":
      filteredMods.sort((a, b) => {
        const aId = a.backendModId;
        const bId = b.backendModId;
        if (aId != null && bId != null) {
          const idDiff = sortOrder === "asc" ? aId - bId : bId - aId;
          if (idDiff !== 0) return idDiff;
          const aDate = toNullableTimestamp(a.installDate);
          const bDate = toNullableTimestamp(b.installDate);
          if (aDate == null && bDate == null) return 0;
          if (aDate == null) return 1;
          if (bDate == null) return -1;
          return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
        }
        if (aId != null && bId == null) return -1;
        if (aId == null && bId != null) return 1;
        const aDate = toNullableTimestamp(a.installDate);
        const bDate = toNullableTimestamp(b.installDate);
        if (aDate == null && bDate == null) return 0;
        if (aDate == null) return 1;
        if (bDate == null) return -1;
        return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
      });
      break;
    case "Updated":
      filteredMods.sort(
        makeTimestampComparator((m) =>
          toNullableTimestamp(m.lastUpdatedRaw ?? m.lastUpdated ?? null),
        ),
      );
      break;
    case "Rating":
      filteredMods.sort((a, b) =>
        applyOrder((b.rating || 0) - (a.rating || 0)),
      );
      break;
    case "Downloads":
      filteredMods.sort((a, b) =>
        applyOrder((b.downloads || 0) - (a.downloads || 0)),
      );
      break;
    case "Performance":
      filteredMods.sort((a, b) =>
        applyOrder((b.performanceImpact || 0) - (a.performanceImpact || 0)),
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
    case "Favourites":
      filteredMods.sort((a, b) => {
        const aFav = a.isFavorited ? 1 : 0;
        const bFav = b.isFavorited ? 1 : 0;
        if (bFav !== aFav) return applyOrder(bFav - aFav);
        return a.name.localeCompare(b.name);
      });
      break;
    default:
      break;
  }

  // Separate active and inactive for display
  const filteredActiveMods = filteredMods.filter(
    (mod) => mod.isActive !== false,
  );
  const filteredInactiveMods = filteredMods.filter(
    (mod) => mod.isActive === false,
  );

  // Selection handlers
  const handleSelect = (modId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredMods.map((m) => m.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchUpdate = () => {
    selectedIds.forEach((id) => onUpdate(id));
    toast.success(`${selectedIds.size} mods queued for update`);
    handleCancelSelection();
  };

  const handleBatchUninstall = () => {
    selectedIds.forEach((id) => onUninstall(id));
    toast.success(`${selectedIds.size} mods queued for removal`);
    handleCancelSelection();
  };

  const handleBatchFavorite = () => {
    selectedIds.forEach((id) => onFavorite(id));
    toast.success(`${selectedIds.size} mods favorited`);
    handleCancelSelection();
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Search Header */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              sortBy={sortBy}
              onSortChange={setSortBy}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
            />
          </div>
          <div className="pr-4 pt-2">
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (selectionMode) handleCancelSelection();
                else setSelectionMode(true);
              }}
            >
              {selectionMode ? "Exit Select" : "Select"}
            </Button>
          </div>
        </div>

        {/* Content */}
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
          }
          .mods-grid {
            display: grid;
            gap: 1.5rem;
            grid-template-columns: 1fr;
          }
          @media (min-width: 768px) {
            .mods-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (min-width: 1024px) {
            .mods-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }
          @media (min-width: 1280px) {
            .mods-grid {
              grid-template-columns: repeat(4, 1fr);
            }
          }
          @media (min-width: 1500px) {
            .mods-grid {
              grid-template-columns: repeat(5, 1fr);
            }
          }
        `}</style>
        <div
          className="flex-1 overflow-auto custom-scrollbar"
          style={{
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
                    viewMode === "grid" ? "mods-grid" : "flex flex-col gap-0"
                  }
                >
                  {filteredActiveMods.map((mod) => (
                    <InstalledModCard
                      key={mod.backendModId ?? mod.id}
                      mod={mod}
                      viewMode={viewMode}
                      onUninstall={onUninstall}
                      onUpdate={onUpdate}
                      onCheckUpdate={onCheckUpdate}
                      onView={(m) => {
                        if (selectionMode) {
                          handleSelect(m.id);
                          return;
                        }
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
                      ? "mods-grid opacity-60"
                      : "flex flex-col gap-0 opacity-60"
                  }
                >
                  {filteredInactiveMods.map((mod) => (
                    <InstalledModCard
                      key={mod.backendModId ?? mod.id}
                      mod={mod}
                      viewMode={viewMode}
                      onUninstall={onUninstall}
                      onUpdate={onUpdate}
                      onCheckUpdate={onCheckUpdate}
                      onView={(m) => {
                        if (selectionMode) {
                          handleSelect(m.id);
                          return;
                        }
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

        {/* Bulk Operations Toolbar */}
        {selectionMode && selectedIds.size > 0 && (
          <div className="sticky bottom-0 p-4 z-20">
            <BulkOperationsToolbar
              selectedCount={selectedIds.size}
              totalCount={filteredMods.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onBatchUpdate={handleBatchUpdate}
              onBatchUninstall={handleBatchUninstall}
              onBatchFavorite={handleBatchFavorite}
              onCancel={handleCancelSelection}
            />
          </div>
        )}
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
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
