import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import {
  Users,
  Search,
  ChevronLeft,
  CheckCircle,
  Package,
} from "lucide-react";
import type { Mod } from "./ModCard";
import { InstalledModCard } from "./InstalledModCard";
import { extractNonCategoryTags } from "../lib/categoryUtils";

interface CharacterBrowserProps {
  mods: Mod[];
  onUpdate: (modId: string) => void | Promise<void>;
  onCheckUpdate: (modId: string) => void | Promise<void>;
  onUninstall: (modId: string) => void | Promise<void>;
  onFavorite: (modId: string) => void;
  onView: (mod: Mod) => void;
}

interface CharacterInfo {
  name: string;
  modCount: number;
  activeCount: number;
  thumbnail?: string;
  mods: Mod[];
}

export function CharacterBrowser({
  mods,
  onUpdate,
  onCheckUpdate,
  onUninstall,
  onFavorite,
  onView,
}: CharacterBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    null,
  );

  // Build character map from mod tags
  const characters = useMemo(() => {
    const charMap = new Map<string, CharacterInfo>();

    for (const mod of mods) {
      if (!mod.isInstalled) continue;
      const nonCatTags = extractNonCategoryTags(mod.tags);
      if (nonCatTags.length === 0) continue;

      const charName = nonCatTags[0];
      if (!charMap.has(charName)) {
        charMap.set(charName, {
          name: charName,
          modCount: 0,
          activeCount: 0,
          thumbnail: mod.images[0],
          mods: [],
        });
      }
      const info = charMap.get(charName)!;
      info.modCount++;
      if (mod.isActive) info.activeCount++;
      info.mods.push(mod);
      // Use the first available image as thumbnail
      if (!info.thumbnail && mod.images[0]) {
        info.thumbnail = mod.images[0];
      }
    }

    return Array.from(charMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [mods]);

  const filteredCharacters = useMemo(() => {
    if (!searchQuery.trim()) return characters;
    const q = searchQuery.toLowerCase();
    return characters.filter((c) => c.name.toLowerCase().includes(q));
  }, [characters, searchQuery]);

  const selectedChar = selectedCharacter
    ? characters.find((c) => c.name === selectedCharacter)
    : null;

  if (selectedChar) {
    return (
      <div className="p-6 animate-slide-in-right">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1"
          onClick={() => setSelectedCharacter(null)}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Characters
        </Button>

        <div className="flex items-center gap-4 mb-6">
          {selectedChar.thumbnail && (
            <img
              src={selectedChar.thumbnail}
              alt={selectedChar.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
          )}
          <div>
            <h2 className="text-2xl font-semibold">{selectedChar.name}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>{selectedChar.modCount} mods</span>
              <span>
                <CheckCircle className="w-3 h-3 inline text-success mr-1" />
                {selectedChar.activeCount} active
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {selectedChar.mods.map((mod) => (
            <InstalledModCard
              key={mod.backendModId ?? mod.id}
              mod={mod}
              viewMode="grid"
              onUninstall={onUninstall}
              onUpdate={onUpdate}
              onCheckUpdate={onCheckUpdate}
              onView={onView}
              onFavorite={onFavorite}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Characters
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Browse mods organized by character
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search characters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredCharacters.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">No characters found</p>
          <p className="text-sm">Install mods to see characters here</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredCharacters.map((char) => (
            <Card
              key={char.name}
              className="card-hover cursor-pointer group"
              onClick={() => setSelectedCharacter(char.name)}
            >
              <CardContent className="p-0">
                <div className="aspect-square bg-muted relative overflow-hidden rounded-t-lg">
                  {char.thumbnail ? (
                    <img
                      src={char.thumbnail}
                      alt={char.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}
                  {char.activeCount > 0 && (
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant="default"
                        className="bg-success text-success-foreground text-[10px]"
                      >
                        <CheckCircle className="w-2.5 h-2.5 mr-1" />
                        {char.activeCount} active
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{char.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Package className="w-3 h-3" />
                    {char.modCount} mod{char.modCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
