import { useMemo, useState } from "react";
import { SearchHeader } from "./SearchHeader";
import { ModCard } from "./ModCard";
import { ModModal } from "./ModModal";
import { AdvancedFilterPanel } from "./AdvancedFilterPanel";
import { BulkOperationsToolbar } from "./BulkOperationsToolbar";
import type { Mod } from "./ModCard";
import type { FilterConfig } from "../lib/filterPresets";
import { extractNonCategoryTags } from "../lib/categoryUtils";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

interface BrowsePageProps {
  mods: Mod[];
  onInstall: (modId: string) => void;
  onFavorite: (modId: string) => void;
}

export function BrowsePage({ mods, onInstall, onFavorite }: BrowsePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("Popular");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);

  // Advanced filter state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState<FilterConfig>({});

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Derive available characters and categories from mods
  const availableCharacters = useMemo(() => {
    const chars = new Set<string>();
    mods.forEach((mod) => {
      const tags = extractNonCategoryTags(mod.tags);
      if (tags.length > 0) chars.add(tags[0]);
    });
    return Array.from(chars).sort();
  }, [mods]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    mods.forEach((mod) => {
      if (mod.categoryTags) mod.categoryTags.forEach((c) => cats.add(c));
      if (mod.category) cats.add(mod.category);
    });
    return Array.from(cats).sort();
  }, [mods]);

  // Count active filters
  const activeFilterCount = [
    filters.characters?.length || 0,
    filters.categories?.length || 0,
    filters.tags?.length || 0,
    filters.hasUpdate ? 1 : 0,
    filters.isActive !== undefined ? 1 : 0,
    filters.isFavorited ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Build filtered mods from live data
  let filteredMods = [...mods];

  // Advanced filter: characters
  if (filters.characters && filters.characters.length > 0) {
    filteredMods = filteredMods.filter((mod) => {
      const tags = extractNonCategoryTags(mod.tags);
      if (tags.length === 0) return false;
      return filters.characters!.includes(tags[0]);
    });
  }

  // Advanced filter: categories
  if (filters.categories && filters.categories.length > 0) {
    filteredMods = filteredMods.filter((mod) => {
      const modCats = mod.categoryTags || (mod.category ? [mod.category] : []);
      return modCats.some((c) => filters.categories!.includes(c));
    });
  }

  // Advanced filter: status
  if (filters.hasUpdate) {
    filteredMods = filteredMods.filter((mod) => mod.hasUpdate);
  }
  if (filters.isActive !== undefined) {
    filteredMods = filteredMods.filter((mod) => mod.isActive === filters.isActive);
  }
  if (filters.isFavorited) {
    filteredMods = filteredMods.filter((mod) => mod.isFavorited);
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredMods = filteredMods.filter(
      (mod) =>
        mod.name.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        mod.author.toLowerCase().includes(q) ||
        (mod.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
  }

  // Sorting
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
    case "Downloads":
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

  const handleBatchFavorite = () => {
    selectedIds.forEach((id) => onFavorite(id));
    toast.success(`${selectedIds.size} mods favorited`);
    handleCancelSelection();
  };

  const handleBatchInstall = () => {
    selectedIds.forEach((id) => onInstall(id));
    toast.success(`${selectedIds.size} mods queued for install`);
    handleCancelSelection();
  };

  // Event handlers
  const handleViewMod = (mod: Mod) => {
    if (selectionMode) {
      handleSelect(mod.id);
      return;
    }
    setSelectedMod(mod);
  };

  return (
    <div className="h-full flex">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortBy={sortBy}
              onSortChange={setSortBy}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
            />
          </div>
          <div className="flex items-center gap-1 pr-4 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterPanelOpen(true)}
              className="gap-1.5 relative"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-1 text-[10px] h-4 min-w-[16px] px-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
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

        {/* Content Area */}
        <style>{`.mods-grid {
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
          }`}</style>
        <div className="flex-1 overflow-auto p-6">
          {/* Results Info */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2">All Mods</h2>
            <p className="text-muted-foreground">
              {filteredMods.length} mod{filteredMods.length !== 1 ? "s" : ""}{" "}
              found
              {searchQuery && ` for "${searchQuery}"`}
              {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active)`}
            </p>
          </div>

          {/* Mods Grid/List */}
          {filteredMods.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No mods found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or browse different
                categories.
              </p>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "mods-grid" : "space-y-0"}>
              {filteredMods.map((mod) => (
                <ModCard
                  key={mod.id}
                  mod={selectionMode ? { ...mod, isSelected: selectedIds.has(mod.id) } : mod}
                  viewMode={viewMode}
                  onInstall={onInstall}
                  onFavorite={onFavorite}
                  onView={handleViewMod}
                  onSelect={handleSelect}
                  selectionMode={selectionMode}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bulk Operations Toolbar */}
        {selectionMode && selectedIds.size > 0 && (
          <div className="sticky bottom-0 p-4 z-20">
            <BulkOperationsToolbar
              selectedCount={selectedIds.size}
              totalCount={filteredMods.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onBatchInstall={handleBatchInstall}
              onBatchFavorite={handleBatchFavorite}
              onCancel={handleCancelSelection}
            />
          </div>
        )}
      </div>

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        open={filterPanelOpen}
        onOpenChange={setFilterPanelOpen}
        filters={filters}
        onFiltersChange={setFilters}
        availableCharacters={availableCharacters}
        availableCategories={availableCategories}
        availableTags={[]}
      />

      {/* Mod Details Modal */}
      <ModModal
        mod={selectedMod}
        isOpen={!!selectedMod}
        onClose={() => setSelectedMod(null)}
        onInstall={onInstall}
        onFavorite={onFavorite}
      />
    </div>
  );
}
