import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { SearchHeader } from "./SearchHeader";
import { ModCard } from "./ModCard";
import { ModModal } from "./ModModal";
import type { Mod } from "./ModCard";
import {
  categoriesMatchTag,
  extractNonCategoryTags,
} from "../lib/categoryUtils";

interface BrowsePageProps {
  mods: Mod[];
  onInstall: (modId: string) => void;
  onFavorite: (modId: string) => void;
}

export function BrowsePage({ mods, onInstall, onFavorite }: BrowsePageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("Popular");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);

  // Build filtered mods from live data (no mock helpers)
  let filteredMods = [...mods];

  // Category filter
  if (selectedCategory && selectedCategory !== "all") {
    filteredMods = filteredMods.filter(
      (mod) =>
        (Array.isArray(mod.categoryTags) &&
          mod.categoryTags.includes(selectedCategory)) ||
        categoriesMatchTag(mod.tags, selectedCategory)
    );
  }

  // Character filter: match against any non-category tag on the mod
  if (selectedCharacters && selectedCharacters.length > 0) {
    filteredMods = filteredMods.filter((mod) =>
      extractNonCategoryTags(mod.tags).some((tag) =>
        selectedCharacters.includes(tag)
      )
    );
  }

  // Tag filter (if any provided via selectedTags)
  if (selectedTags && selectedTags.length > 0) {
    filteredMods = filteredMods.filter((mod) =>
      selectedTags.every((tag) => (mod.tags || []).includes(tag))
    );
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredMods = filteredMods.filter(
      (mod) =>
        mod.name.toLowerCase().includes(q) ||
        mod.description.toLowerCase().includes(q) ||
        mod.author.toLowerCase().includes(q) ||
        (mod.tags || []).some((t) => t.toLowerCase().includes(q))
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

  const makeTimestampComparator = (
    getter: (m: Mod) => number | null
  ) => {
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
      filteredMods.sort((a, b) => applyOrder((b.downloads || 0) - (a.downloads || 0)));
      break;
    case "Recent":
      // Recent: sort by installDate (local_downloads.created_at)
      filteredMods.sort(
        makeTimestampComparator((m) => toNullableTimestamp(m.installDate))
      );
      break;
    case "Updated":
      // Updated: sort by mods.updated_at (lastUpdatedRaw/lastUpdated), NULLs last
      filteredMods.sort(
        makeTimestampComparator((m) =>
          toNullableTimestamp(m.lastUpdatedRaw ?? m.lastUpdated ?? null)
        )
      );
      break;
    case "Rating":
      filteredMods.sort((a, b) => applyOrder((b.rating || 0) - (a.rating || 0)));
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

  // Event handlers
  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleCharacterToggle = (character: string) => {
    setSelectedCharacters((prev) =>
      prev.includes(character)
        ? prev.filter((c) => c !== character)
        : [...prev, character]
    );
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    // Clear character filters when switching away from characters
    if (category !== "characters") {
      setSelectedCharacters([]);
    }
  };

  const handleViewMod = (mod: Mod) => {
    setSelectedMod(mod);
  };

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <Sidebar
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        selectedCharacters={selectedCharacters}
        onCharacterToggle={handleCharacterToggle}
        mods={mods}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
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
            <h2 className="text-2xl font-semibold mb-2">
              {selectedCategory === "all"
                ? "All Mods"
                : selectedCategory === "characters"
                ? "Character Mods"
                : selectedCategory === "ui"
                ? "UI Mods"
                : selectedCategory === "maps"
                ? "Map Mods"
                : selectedCategory === "audio"
                ? "Audio Mods"
                : "Mods"}
            </h2>
            <p className="text-muted-foreground">
              {filteredMods.length} mod{filteredMods.length !== 1 ? "s" : ""}{" "}
              found
              {searchQuery && ` for "${searchQuery}"`}
              {selectedCharacters.length > 0 &&
                ` for ${selectedCharacters.join(", ")}`}
              {selectedTags.length > 0 &&
                ` with tags: ${selectedTags.join(", ")}`}
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
            <div
              className={
                viewMode === "grid"
                  ? "mods-grid"
                  : "space-y-0"
              }
            >
              {filteredMods.map((mod) => (
                <ModCard
                  key={mod.id}
                  mod={mod}
                  viewMode={viewMode}
                  onInstall={onInstall}
                  onFavorite={onFavorite}
                  onView={handleViewMod}
                />
              ))}
            </div>
          )}
        </div>
      </div>

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
