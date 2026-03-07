import { useCallback, useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import {
  AlertTriangle,
  RefreshCw,
  Shield,
  FileWarning,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  listConflicts,
  refreshConflicts,
  type ApiConflict,
} from "../lib/api";

interface ConflictDashboardProps {
  mods: any[];
  onView?: (mod: any) => void;
}

export function ConflictDashboard({ mods, onView }: ConflictDashboardProps) {
  const [conflicts, setConflicts] = useState<ApiConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const fetchConflicts = useCallback(async () => {
    try {
      const data = await listConflicts(100, showOnlyActive);
      setConflicts(data);
    } catch (err) {
      console.error("Failed to load conflicts", err);
    } finally {
      setLoading(false);
    }
  }, [showOnlyActive]);

  useEffect(() => {
    setLoading(true);
    void fetchConflicts();
  }, [fetchConflicts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshConflicts();
      await fetchConflicts();
    } catch (err) {
      console.error("Failed to refresh conflicts", err);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleExpand = (assetPath: string) => {
    setExpandedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(assetPath)) next.delete(assetPath);
      else next.add(assetPath);
      return next;
    });
  };

  // Group conflicts by severity
  const highSeverity = conflicts.filter((c) => c.conflicting_mod_count >= 3);
  const mediumSeverity = conflicts.filter((c) => c.conflicting_mod_count === 2);
  const totalMods = new Set(
    conflicts.flatMap((c) =>
      c.participants.flatMap((p) =>
        p.mods.map((m) => m.mod_id ?? m.pak_file)
      )
    )
  ).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading conflicts...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Conflict Resolution
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {conflicts.length} conflicting asset{conflicts.length !== 1 ? "s" : ""} across {totalMods} mod{totalMods !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showOnlyActive ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyActive(!showOnlyActive)}
          >
            {showOnlyActive ? "Active Only" : "All Conflicts"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium">High Severity</span>
          </div>
          <p className="text-2xl font-bold">{highSeverity.length}</p>
          <p className="text-xs text-muted-foreground">3+ mods conflicting</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileWarning className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium">Medium Severity</span>
          </div>
          <p className="text-2xl font-bold">{mediumSeverity.length}</p>
          <p className="text-xs text-muted-foreground">2 mods conflicting</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Total Assets</span>
          </div>
          <p className="text-2xl font-bold">{conflicts.length}</p>
          <p className="text-xs text-muted-foreground">conflicting assets</p>
        </div>
      </div>

      {/* Conflict list */}
      {conflicts.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          <h3 className="text-lg font-medium mb-1">No Conflicts</h3>
          <p className="text-muted-foreground text-sm">
            {showOnlyActive
              ? "No active mod conflicts detected. Your mods are clean!"
              : "No conflicts found in the database."}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-2">
            {conflicts.map((conflict) => {
              const isExpanded = expandedAssets.has(conflict.asset_path);
              const severity =
                conflict.conflicting_mod_count >= 3
                  ? "destructive"
                  : "secondary";

              return (
                <div
                  key={conflict.asset_path}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpand(conflict.asset_path)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate">
                        {conflict.asset_path}
                      </p>
                      {conflict.category && (
                        <span className="text-xs text-muted-foreground">
                          {conflict.category}
                        </span>
                      )}
                    </div>
                    <Badge variant={severity as any} className="shrink-0">
                      {conflict.conflicting_mod_count} mods
                    </Badge>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-3 py-2 bg-muted/30 space-y-2 animate-fade-in">
                      {conflict.participants.map((participant) => (
                        <div key={participant.pak_name} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            {participant.pak_name}
                            {participant.merged_tag && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                {participant.merged_tag}
                              </Badge>
                            )}
                          </p>
                          {participant.mods.map((mod, i) => {
                            const uiMod = mod.mod_id
                              ? mods.find(
                                  (m) =>
                                    m.backendModId === mod.mod_id ||
                                    m.id === String(mod.mod_id)
                                )
                              : undefined;
                            return (
                              <div
                                key={`${mod.pak_file}-${i}`}
                                className="flex items-center gap-2 pl-4 py-1"
                              >
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    mod.is_current
                                      ? "bg-emerald-500"
                                      : "bg-muted-foreground/40"
                                  }`}
                                />
                                <span className="text-sm flex-1 truncate">
                                  {mod.mod_name || mod.pak_file}
                                </span>
                                {mod.is_current && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-emerald-500 border-emerald-500/30"
                                  >
                                    Winner
                                  </Badge>
                                )}
                                {uiMod && onView && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => onView(uiMod)}
                                  >
                                    View
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
