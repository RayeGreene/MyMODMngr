import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Package, Bell, Settings, RefreshCw, Rocket } from "lucide-react";

interface AppHeaderProps {
  downloadsCount: number;
  updatesCount: number;
  activeModsCount: number;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenBootstrap?: () => void;
}

export function AppHeader({
  downloadsCount,
  updatesCount,
  activeModsCount,
  onRefresh,
  onOpenSettings,
  onOpenBootstrap,
}: AppHeaderProps) {
  return (
    <div className="bg-card border-b border-border">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold">Marvel Rivals</h1>
            <p className="text-sm text-muted-foreground">Mod Manager</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Status Indicators */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Installed:</span>
              <Badge variant="secondary">{downloadsCount}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Active:</span>
              <Badge variant="secondary">{activeModsCount}</Badge>
            </div>
            {updatesCount > 0 && (
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-destructive" />
                <span className="text-destructive">
                  {updatesCount} update{updatesCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {onOpenBootstrap && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenBootstrap}
                className="gap-2"
              >
                <Rocket className="w-4 h-4" />
                Setup
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onOpenSettings}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
