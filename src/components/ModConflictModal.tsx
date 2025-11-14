import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { AlertTriangle } from "lucide-react";

interface MockMod {
  mod_id: number | null;
  mod_name: string | null;
  pak_file: string;
  icon?: string | null;
  is_current?: boolean;
  local_download_id?: number | null;
}

interface Participant {
  pak_name: string;
  merged_tag?: string;
  mods: MockMod[];
}

interface MockAssetConflict {
  asset_path: string;
  category?: string;
  conflicting_mod_count?: number;
  total_paks?: number;
  participants: Participant[];
}

interface ModConflictModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // accept either the mockConflicts shape or the normalized AssetConflict[] used earlier
  conflicts?: MockAssetConflict[] | any[];
  title?: string;
}

export function ModConflictModal({
  open,
  onOpenChange,
  conflicts = [],
  title = "Mod Conflicts",
}: ModConflictModalProps) {
  const FALLBACK_ICON_URL =
    "https://i.pinimg.com/1200x/44/da/5e/44da5e6d9dd75cb753ab5925aff4ce4c.jpg";
  // If conflicts are in mockConflicts format (asset_path exists), use directly.
  const isMockShape =
    Array.isArray(conflicts) &&
    (conflicts as any[]).length > 0 &&
    "asset_path" in (conflicts as any)[0];

  const items: MockAssetConflict[] = isMockShape
    ? (conflicts as MockAssetConflict[])
    : // otherwise attempt to map from the normalized { assetPath, sources } shape
      (conflicts as any[]).map((c) => ({
        asset_path: c.assetPath || c.asset_path || "",
        category: c.category,
        conflicting_mod_count: c.sources ? c.sources.length : 0,
        total_paks: c.total_paks || 0,
        participants: (c.sources || c.participants || []).map((s: any) => ({
          pak_name: s.label || s.pak || s.pak_name || s.name || "pak",
          merged_tag: s.merged_tag || s.mergedTag,
          mods: s.mods
            ? s.mods
            : s.thumbnail || s.name
            ? [
                {
                  mod_id: 0,
                  mod_name: s.name || s.pak_name,
                  pak_file: s.label || s.pak_name,
                  icon: s.thumbnail,
                  is_current: false,
                },
              ]
            : [],
        })),
      }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full bg-card border border-border rounded-2xl shadow-2xl p-0"
        style={{
          maxWidth: "min(1200px, 95vw)",
          height: "90vh",
          maxHeight: "90vh",
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between w-full px-6 pt-6 pb-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="text-destructive w-6 h-6" />
              </span>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {title}
              </DialogTitle>
              <Badge
                variant="destructive"
                className="text-xs px-2 py-1 rounded-full font-semibold bg-destructive/90 text-destructive-foreground/90"
              >
                {items.length} assets
              </Badge>
            </div>
          </div>
        </DialogHeader>

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
          }`}</style>
        <div className="mt-2 flex-1 min-h-0 h-[calc(90vh-120px)] max-h-[calc(90vh-120px)] overflow-y-auto space-y-6 px-6 pb-2 custom-scrollbar bg-card">
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-base font-medium">
              <p>
                No mod conflicts detected. Your installed mods are compatible!
              </p>
            </div>
          ) : (
            items.map((asset, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* Stylish header for asset path (icon removed for less redundancy) */}
                <div className="flex items-center gap-1 px-5 pt-5 pb-3 pr-2 rounded-t-xl bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border/60">
                  <span
                    className="font-mono text-xl font-bold text-primary break-all truncate px-3 py-1"
                    style={{ lineHeight: "1.5" }}
                    title={asset.asset_path}
                  >
                    {asset.asset_path}
                  </span>
                  {asset.category ? (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground/90 text-xs font-bold uppercase tracking-wider">
                      {asset.category}
                    </span>
                  ) : null}
                  <div className="flex-1" />
                  <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full font-semibold text-xs">
                    <span className="text-primary font-bold">
                      {asset.conflicting_mod_count ??
                        asset.participants.reduce(
                          (a, b) => a + (b.mods?.length || 0),
                          0
                        )}
                    </span>
                    mods
                  </span>
                  <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full font-semibold text-xs ml-2">
                    <span className="text-primary font-bold">
                      {(() => {
                        // Count unique pak files across all participants
                        const pakSet = new Set(
                          asset.participants.flatMap((p) =>
                            p.mods && p.mods.length > 0
                              ? p.mods.map((m) => m.pak_file)
                              : [p.pak_name]
                          )
                        );
                        return pakSet.size;
                      })()}
                    </span>
                    paks
                  </span>
                </div>

                <div className="p-5 pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 py-2 px-2">
                    {asset.participants
                      .flatMap((p) => p.mods || [])
                      .filter(Boolean)
                      .map((m: MockMod) => {
                        const displayName =
                          (m.mod_name && m.mod_name.trim()) ||
                          (m.pak_file && m.pak_file.trim()) ||
                          "Unknown Mod";
                        const resolvedIcon =
                          (m.icon && m.icon.trim()) || FALLBACK_ICON_URL;
                        return (
                          <div
                            key={`${m.mod_id}-${m.pak_file}`}
                            className={`w-full bg-card border border-border/70 rounded-lg p-6 grid place-items-center gap-2 text-center shadow-sm ${
                              m.is_current ? "ring-2 ring-primary/30" : ""
                            }`}
                          >
                            <div className="h-32 max-w-full min-w-0 rounded-xl overflow-hidden bg-muted-foreground/10 grid place-items-center border border-muted-foreground/10">
                              <div
                                style={{
                                  height: "8rem",
                                  minHeight: "8rem",
                                  maxHeight: "8rem",
                                }}
                                className="flex items-center justify-center w-full h-32"
                              >
                                <img
                                  src={resolvedIcon}
                                  alt={displayName}
                                  className="h-32 min-h-32 max-h-32 w-auto object-contain"
                                  style={{
                                    height: "8rem",
                                    minHeight: "8rem",
                                    maxHeight: "8rem",
                                  }}
                                  onError={(e) => {
                                    if (
                                      e.currentTarget.src !== FALLBACK_ICON_URL
                                    ) {
                                      e.currentTarget.src = FALLBACK_ICON_URL;
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <div
                              className="mt-2 text-base truncate w-full text-foreground"
                              title={displayName}
                            >
                              {displayName}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
