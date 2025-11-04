import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Checkbox } from "./ui/checkbox";
import {
  Users,
  Palette,
  Map,
  Volume2,
  Settings,
  Download,
  Heart,
  Clock,
  ChevronDown,
} from "lucide-react";
import type { Mod } from "./ModCard";
import { extractNonCategoryTags } from "../lib/categoryUtils";

interface SidebarProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  selectedCharacters?: string[];
  onCharacterToggle?: (character: string) => void;
  mods: Mod[];
}

const categories = [
  { id: "all", label: "All Categories", icon: Settings },
  { id: "characters", label: "Characters", icon: Users },
  { id: "ui", label: "User Interface", icon: Palette },
  { id: "maps", label: "Maps & Environments", icon: Map },
  { id: "audio", label: "Audio & Music", icon: Volume2 },
];

const popularTags = [
  "HD Texture",
  "Animation",
  "Classic",
  "Avengers",
  "X-Men",
  "Magic",
  "Armor",
  "Recolor",
  "Modern",
  "Vintage",
];

export function Sidebar({
  selectedCategory,
  onCategoryChange,
  selectedTags,
  onTagToggle,
  selectedCharacters = [],
  onCharacterToggle,
  mods,
}: SidebarProps) {
  const availableCharacters = Array.from(
    new Set(
      (mods || [])
        .flatMap((m) => extractNonCategoryTags(m.tags))
        .filter((c): c is string => !!c && c.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
  const isCharactersSelected = selectedCategory === "characters";

  return (
    <div className="w-80 bg-card border-r border-border h-full flex flex-col">
      <div className="p-6">
        <h2 className="font-semibold mb-4">Browse Categories</h2>
        <div className="space-y-1">
          {categories.map((category) => {
            const Icon = category.icon;

            return (
              <div key={category.id}>
                <Button
                  variant={
                    selectedCategory === category.id ? "secondary" : "ghost"
                  }
                  className="w-full justify-start gap-3 h-10"
                  onClick={() => onCategoryChange(category.id)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{category.label}</span>
                  {category.id === "characters" &&
                    availableCharacters.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {availableCharacters.length}
                      </Badge>
                    )}
                </Button>

                {/* Character Subcategories Dropdown */}
                {category.id === "characters" &&
                  isCharactersSelected &&
                  onCharacterToggle && (
                    <Collapsible defaultOpen className="mt-2 ml-6">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 h-8 text-sm"
                        >
                          <ChevronDown className="w-3 h-3" />
                          Filter by Character
                          {selectedCharacters.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-xs ml-auto"
                            >
                              {selectedCharacters.length}
                            </Badge>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 mt-2">
                        {availableCharacters.map((character) => (
                          <div
                            key={character}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`character-${character}`}
                              checked={selectedCharacters.includes(character)}
                              onCheckedChange={() =>
                                onCharacterToggle(character)
                              }
                            />
                            <label
                              htmlFor={`character-${character}`}
                              className="text-sm cursor-pointer flex-1 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {character}
                            </label>
                          </div>
                        ))}
                        {selectedCharacters.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              selectedCharacters.forEach((char) =>
                                onCharacterToggle(char)
                              );
                            }}
                          >
                            Clear Selection
                          </Button>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="p-6">
        <h3 className="font-medium mb-3">Popular Tags</h3>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => (
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? "secondary" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => onTagToggle(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="p-6">
        <h3 className="font-medium mb-3">Quick Filters</h3>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start gap-3">
            <Download className="w-4 h-4" />
            <span className="flex-1 text-left">Most Downloaded</span>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3">
            <Heart className="w-4 h-4" />
            <span className="flex-1 text-left">Favorites</span>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3">
            <Clock className="w-4 h-4" />
            <span className="flex-1 text-left">Recently Updated</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
