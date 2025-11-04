import { Button } from "./ui/button";
import { AddModModal } from "./AddModModal";
import { useState } from "react";
import { Input } from "./ui/input";
import {
  Search,
  SlidersHorizontal,
  Grid3X3,
  List,
  Plus,
  Settings,
  Moon,
  Sun,
} from "lucide-react";
// Removed dropdown imports
import { useTheme } from "./ThemeProvider";

interface SearchHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  onModAdded?: () => Promise<void> | void;
}

export function SearchHeader({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  onModAdded,
}: SearchHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [addModOpen, setAddModOpen] = useState(false);

  // Sort options to cycle through
  const sortOptions = ["Popular", "Recent", "Updated", "Rating"];
  const currentSortIndex = sortOptions.indexOf(sortBy);
  const handleSortClick = () => {
    const nextIndex = (currentSortIndex + 1) % sortOptions.length;
    onSortChange(sortOptions[nextIndex]);
  };

  return (
    <div className="bg-card border-b border-border p-4">
      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search mods..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sort Button (cycles on click) */}
        <Button variant="outline" className="gap-2" onClick={handleSortClick}>
          <SlidersHorizontal className="w-4 h-4" />
          Sort: {sortBy}
        </Button>

        {/* View Mode Toggle */}
        <div className="flex border border-border rounded-lg">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("grid")}
            className="rounded-r-none"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("list")}
            className="rounded-l-none border-l"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>

        {/* Add Mods Button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setAddModOpen(true)}
        >
          <Plus className="w-4 h-4" />
          Add Mods
        </Button>

        <Button variant="outline" size="sm" onClick={toggleTheme}>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
      {/* Add Mods Modal */}
      <AddModModal
        open={addModOpen}
        onOpenChange={setAddModOpen}
        onSuccess={onModAdded}
      />
    </div>
  );
}
