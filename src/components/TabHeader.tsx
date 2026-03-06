import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Bell, Settings, RefreshCw, Rocket } from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";

interface TabHeaderProps {
  activeTab: "downloads" | "active";
  onTabChange: (tab: "downloads" | "active") => void;
  downloadsCount: number;
  activeCount: number;
  updatesCount?: number;
  activeModsCount?: number;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onOpenBootstrap?: () => void;
  /** Notification bell */
  notificationCount?: number;
  onOpenNotifications?: () => void;
}

export function TabHeader({
  activeTab,
  onTabChange,
  downloadsCount,
  activeCount,
  updatesCount = 0,
  activeModsCount: _activeModsCount = 0,
  onRefresh,
  onOpenSettings,
  onOpenBootstrap,
  notificationCount = 0,
  onOpenNotifications,
}: TabHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center p-4 justify-between">
        <div className="flex gap-1 relative">
          <button
            type="button"
            onClick={() => onTabChange("downloads")}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "downloads"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Downloads
            <Badge
              variant={activeTab === "downloads" ? "default" : "secondary"}
              className="text-xs"
            >
              <AnimatedCounter value={downloadsCount} />
            </Badge>
            {activeTab === "downloads" && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full animate-tab-indicator" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange("active")}
            className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "active"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Active Mods
            <Badge
              variant={activeTab === "active" ? "default" : "secondary"}
              className="text-xs"
            >
              <AnimatedCounter value={activeCount} />
            </Badge>
            {updatesCount > 0 && (
              <Badge variant="destructive" className="text-xs ml-1">
                {updatesCount}
              </Badge>
            )}
            {activeTab === "active" && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full animate-tab-indicator" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          {onOpenNotifications && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenNotifications}
              className="relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-notification-bounce">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </Button>
          )}

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
  );
}
