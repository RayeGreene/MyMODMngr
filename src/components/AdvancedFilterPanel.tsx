import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Checkbox } from "./ui/checkbox";
import {
  SlidersHorizontal,
  Save,
  X,
  RotateCcw,
  Bookmark,
} from "lucide-react";
import {
  listFilterPresets,
  createFilterPreset,
  deleteFilterPreset,
  type FilterConfig,
  type FilterPreset,
} from "../lib/filterPresets";

interface AdvancedFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
  /** Available characters for filtering */
  availableCharacters: string[];
  /** Available categories */
  availableCategories: string[];
  /** Available tags */
  availableTags: string[];
}

export function AdvancedFilterPanel({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  availableCharacters,
  availableCategories,
  availableTags: _availableTags,
}: AdvancedFilterPanelProps) {
  const [presets, setPresets] = useState<FilterPreset[]>(() =>
    listFilterPresets(),
  );
  const [savePresetName, setSavePresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);

  const updateFilter = (patch: Partial<FilterConfig>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const toggleArrayItem = (
    key: keyof Pick<FilterConfig, "characters" | "categories" | "tags">,
    value: string,
  ) => {
    const current = filters[key] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter({ [key]: next });
  };

  const handleSavePreset = () => {
    if (!savePresetName.trim()) return;
    createFilterPreset(savePresetName.trim(), filters);
    setPresets(listFilterPresets());
    setSavePresetName("");
    setShowSavePreset(false);
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    onFiltersChange(preset.filters);
  };

  const handleDeletePreset = (id: string) => {
    deleteFilterPreset(id);
    setPresets(listFilterPresets());
  };

  const handleReset = () => {
    onFiltersChange({});
  };

  const activeFilterCount = [
    filters.characters?.length || 0,
    filters.categories?.length || 0,
    filters.tags?.length || 0,
    filters.hasUpdate ? 1 : 0,
    filters.isActive !== undefined ? 1 : 0,
    filters.isFavorited ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[360px] sm:w-[400px] flex flex-col">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5" />
              Advanced Filters
              {activeFilterCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </SheetTitle>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6 py-4">
          <div className="space-y-6">
            {/* Status Filters */}
            <div>
              <h4 className="text-sm font-medium mb-2">Status</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.hasUpdate === true}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      updateFilter({
                        hasUpdate: checked === true ? true : undefined,
                      })
                    }
                  />
                  Has updates available
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.isActive === true}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      updateFilter({
                        isActive: checked === true ? true : undefined,
                      })
                    }
                  />
                  Active only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={filters.isFavorited === true}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      updateFilter({
                        isFavorited: checked === true ? true : undefined,
                      })
                    }
                  />
                  Favorites only
                </label>
              </div>
            </div>

            <Separator />

            {/* Characters */}
            {availableCharacters.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Characters ({availableCharacters.length})
                </h4>
                <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto">
                  {availableCharacters.map((char) => (
                    <button
                      key={char}
                      type="button"
                      onClick={() => toggleArrayItem("characters", char)}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        filters.characters?.includes(char)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Categories */}
            {availableCategories.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Categories</h4>
                <div className="space-y-2">
                  {availableCategories.map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={filters.categories?.includes(cat) ?? false}
                        onCheckedChange={() =>
                          toggleArrayItem("categories", cat)
                        }
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Saved Presets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Saved Presets</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSavePreset(!showSavePreset)}
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save
                </Button>
              </div>

              {showSavePreset && (
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Preset name..."
                    value={savePresetName}
                    onChange={(e) => setSavePresetName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                  />
                  <Button size="sm" onClick={handleSavePreset}>
                    Save
                  </Button>
                </div>
              )}

              {presets.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No saved presets
                </p>
              ) : (
                <div className="space-y-1">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm flex-1 text-left"
                        onClick={() => handleLoadPreset(preset)}
                      >
                        <Bookmark className="w-3.5 h-3.5 text-primary" />
                        {preset.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
