import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  ArrowLeftRight,
  Download,
  Star,
  Calendar,
  User,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface ModCompareProps {
  mods: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModCompare({ mods, open, onOpenChange }: ModCompareProps) {
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const installedMods = useMemo(
    () => mods.filter((m) => m.isInstalled),
    [mods]
  );

  const filteredMods = useMemo(() => {
    if (!searchQuery) return installedMods;
    const q = searchQuery.toLowerCase();
    return installedMods.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.author?.toLowerCase().includes(q)
    );
  }, [installedMods, searchQuery]);

  const leftMod = leftId ? mods.find((m) => m.id === leftId) : null;
  const rightMod = rightId ? mods.find((m) => m.id === rightId) : null;

  const selectMod = (modId: string) => {
    if (!leftId) {
      setLeftId(modId);
    } else if (!rightId && modId !== leftId) {
      setRightId(modId);
    }
  };

  const clearSelection = () => {
    setLeftId(null);
    setRightId(null);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
  };

  const compareField = (
    label: string,
    leftVal: string | number | undefined | null,
    rightVal: string | number | undefined | null,
    icon?: React.ReactNode,
    highlightHigher = false
  ) => {
    const lv = leftVal ?? "N/A";
    const rv = rightVal ?? "N/A";
    const leftBetter =
      highlightHigher &&
      typeof leftVal === "number" &&
      typeof rightVal === "number" &&
      leftVal > rightVal;
    const rightBetter =
      highlightHigher &&
      typeof rightVal === "number" &&
      typeof leftVal === "number" &&
      rightVal > leftVal;

    return (
      <div className="grid grid-cols-3 gap-4 py-2 border-b border-border/50">
        <div className={`text-sm text-right ${leftBetter ? "text-emerald-500 font-medium" : ""}`}>
          {String(lv)}
        </div>
        <div className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          {icon}
          {label}
        </div>
        <div className={`text-sm ${rightBetter ? "text-emerald-500 font-medium" : ""}`}>
          {String(rv)}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Mod Comparison
          </DialogTitle>
        </DialogHeader>

        {(!leftMod || !rightMod) ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select {!leftId ? "the first" : "the second"} mod to compare.
              {leftMod && (
                <span className="ml-1">
                  First: <strong>{leftMod.name}</strong>
                  <button
                    type="button"
                    onClick={() => setLeftId(null)}
                    className="ml-1 text-destructive hover:text-destructive/80"
                  >
                    <X className="w-3 h-3 inline" />
                  </button>
                </span>
              )}
            </p>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mods..."
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm"
            />
            <div className="max-h-[400px] overflow-auto space-y-1">
              {filteredMods.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  disabled={mod.id === leftId}
                  onClick={() => selectMod(mod.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-3 ${
                    mod.id === leftId
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {mod.images?.[0] && (
                    <img
                      src={mod.images[0]}
                      alt=""
                      className="w-8 h-8 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{mod.name}</p>
                    <p className="text-xs text-muted-foreground">{mod.author}</p>
                  </div>
                  {mod.id === leftId && (
                    <Badge variant="default" className="text-[10px]">Selected</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear & Start Over
              </Button>
            </div>

            {/* Mod headers */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                {leftMod.images?.[0] && (
                  <img
                    src={leftMod.images[0]}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover mx-auto mb-2"
                  />
                )}
                <p className="font-medium text-sm truncate">{leftMod.name}</p>
                <p className="text-xs text-muted-foreground">{leftMod.author}</p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowLeftRight className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                {rightMod.images?.[0] && (
                  <img
                    src={rightMod.images[0]}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover mx-auto mb-2"
                  />
                )}
                <p className="font-medium text-sm truncate">{rightMod.name}</p>
                <p className="text-xs text-muted-foreground">{rightMod.author}</p>
              </div>
            </div>

            {/* Comparison fields */}
            <div className="bg-card border border-border rounded-lg px-4 py-2">
              {compareField("Version", leftMod.version, rightMod.version)}
              {compareField(
                "Downloads",
                leftMod.downloads,
                rightMod.downloads,
                <Download className="w-3 h-3" />,
                true
              )}
              {compareField(
                "Rating",
                leftMod.rating,
                rightMod.rating,
                <Star className="w-3 h-3" />,
                true
              )}
              {compareField(
                "Author",
                leftMod.author,
                rightMod.author,
                <User className="w-3 h-3" />
              )}
              {compareField(
                "Last Updated",
                formatDate(leftMod.lastUpdatedRaw),
                formatDate(rightMod.lastUpdatedRaw),
                <Calendar className="w-3 h-3" />
              )}
              {compareField(
                "Release Date",
                formatDate(leftMod.releaseDate),
                formatDate(rightMod.releaseDate),
                <Calendar className="w-3 h-3" />
              )}
              {compareField(
                "Status",
                leftMod.isActive !== false ? "Active" : "Disabled",
                rightMod.isActive !== false ? "Active" : "Disabled"
              )}
              {compareField(
                "Has Update",
                leftMod.hasUpdate ? "Yes" : "No",
                rightMod.hasUpdate ? "Yes" : "No"
              )}
              {compareField(
                "Category",
                leftMod.categoryTags?.[0] || leftMod.category || "N/A",
                rightMod.categoryTags?.[0] || rightMod.category || "N/A"
              )}
              {compareField(
                "Tags",
                (leftMod.tags || []).join(", ") || "None",
                (rightMod.tags || []).join(", ") || "None"
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
