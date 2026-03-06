import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import type { Mod } from "./ModCard";

interface UpdateCenterProps {
  mods: Mod[];
  onUpdate: (modId: string) => void | Promise<void>;
  onUpdateAll: () => void | Promise<void>;
  onCheckUpdate?: (modId: string) => void | Promise<void>;
  onView: (mod: Mod) => void;
}

export function UpdateCenter({
  mods,
  onUpdate,
  onUpdateAll,
  onCheckUpdate: _onCheckUpdate,
  onView,
}: UpdateCenterProps) {
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  const modsWithUpdates = useMemo(
    () => mods.filter((m) => m.isInstalled && m.hasUpdate),
    [mods],
  );

  const updatingMods = useMemo(
    () => mods.filter((m) => m.isUpdating),
    [mods],
  );

  const upToDateMods = useMemo(
    () =>
      mods.filter(
        (m) => m.isInstalled && !m.hasUpdate && !m.isUpdating,
      ),
    [mods],
  );

  const totalInstalled = mods.filter((m) => m.isInstalled).length;
  const progress =
    totalInstalled > 0
      ? Math.round(((totalInstalled - modsWithUpdates.length) / totalInstalled) * 100)
      : 100;

  const handleUpdateAll = async () => {
    setIsUpdatingAll(true);
    try {
      await Promise.resolve(onUpdateAll());
    } finally {
      setIsUpdatingAll(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-primary" />
            Update Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {modsWithUpdates.length} update{modsWithUpdates.length !== 1 ? "s" : ""}{" "}
            available
          </p>
        </div>
        {modsWithUpdates.length > 0 && (
          <Button
            onClick={handleUpdateAll}
            disabled={isUpdatingAll}
            className="gap-2"
          >
            {isUpdatingAll ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Update All ({modsWithUpdates.length})
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Status</span>
            <span className="text-sm text-muted-foreground">
              {progress}% up to date
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-success" />
              {upToDateMods.length} up to date
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-warning" />
              {modsWithUpdates.length} pending
            </span>
            {updatingMods.length > 0 && (
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {updatingMods.length} updating
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mods needing updates */}
      {modsWithUpdates.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Available Updates</h3>
          <div className="space-y-2">
            {modsWithUpdates.map((mod) => (
              <Card key={mod.id} className="card-hover">
                <CardContent className="p-4 flex items-center gap-4">
                  {mod.images[0] && (
                    <img
                      src={mod.images[0]}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 cursor-pointer"
                      onClick={() => onView(mod)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => onView(mod)}
                    >
                      {mod.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{mod.author}</span>
                      {mod.installedVersion && mod.latestVersion && (
                        <>
                          <span>•</span>
                          <span>
                            {mod.installedVersion} → {mod.latestVersion}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onUpdate(mod.id)}
                    disabled={mod.isUpdating}
                    className="gap-1.5"
                  >
                    {mod.isUpdating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {mod.isUpdating ? "Updating…" : "Update"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Updating */}
      {updatingMods.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Currently Updating</h3>
          <div className="space-y-2">
            {updatingMods.map((mod) => (
              <Card key={mod.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  {mod.images[0] && (
                    <img
                      src={mod.images[0]}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate text-sm">{mod.name}</h4>
                  </div>
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All up to date */}
      {modsWithUpdates.length === 0 && updatingMods.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-success opacity-60" />
          <h3 className="text-lg font-medium mb-1">All mods are up to date</h3>
          <p className="text-sm text-muted-foreground">
            {totalInstalled} mod{totalInstalled !== 1 ? "s" : ""} installed, all
            current
          </p>
        </div>
      )}
    </div>
  );
}
