import { useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import {
  HardDrive,
  AlertTriangle,
} from "lucide-react";
import type { Mod } from "./ModCard";

interface StorageDashboardProps {
  mods: Mod[];
  onView: (mod: Mod) => void;
}

export function StorageDashboard({ mods, onView }: StorageDashboardProps) {
  const installedMods = useMemo(
    () => mods.filter((m) => m.isInstalled),
    [mods],
  );

  const activeMods = useMemo(
    () => installedMods.filter((m) => m.isActive),
    [installedMods],
  );

  const inactiveMods = useMemo(
    () => installedMods.filter((m) => !m.isActive),
    [installedMods],
  );

  // Group by character
  const byCharacter = useMemo(() => {
    const map = new Map<string, Mod[]>();
    for (const mod of installedMods) {
      const char = mod.character || mod.tags[0] || "Unknown";
      if (!map.has(char)) map.set(char, []);
      map.get(char)!.push(mod);
    }
    return Array.from(map.entries())
      .map(([name, mods]) => ({ name, count: mods.length, mods }))
      .sort((a, b) => b.count - a.count);
  }, [installedMods]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-primary" />
          Storage Analytics
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your mod library
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Mods</div>
            <div className="text-3xl font-bold mt-1">{installedMods.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              Active
            </div>
            <div className="text-3xl font-bold mt-1 text-success">
              {activeMods.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Inactive</div>
            <div className="text-3xl font-bold mt-1 text-muted-foreground">
              {inactiveMods.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Character */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-4">Mods by Character</h3>
          {byCharacter.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data available</p>
          ) : (
            <div className="space-y-3">
              {byCharacter.slice(0, 15).map((entry) => (
                <div key={entry.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="truncate">{entry.name}</span>
                    <span className="text-muted-foreground">
                      {entry.count} mod{entry.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <Progress
                    value={(entry.count / installedMods.length) * 100}
                    className="h-1.5"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Mods — cleanup suggestion */}
      {inactiveMods.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Inactive Mods ({inactiveMods.length})
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              These mods are installed but not active. Consider removing them to
              save space.
            </p>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {inactiveMods.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between py-1"
                >
                  <span
                    className="text-sm truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => onView(mod)}
                  >
                    {mod.name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {mod.author}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
