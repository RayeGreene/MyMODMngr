import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import {
  Clock,
  Download,
  Trash2,
  RefreshCw,
  Heart,
  Layers,
  Power,
  PowerOff,
  Settings,
  X,
} from "lucide-react";
import {
  listActivities,
  clearActivities,
  subscribe,
  actionLabel,
  type ActivityEntry,
  type ActivityAction,
} from "../lib/activityLog";

const actionIcons: Record<ActivityAction, typeof Download> = {
  install: Download,
  uninstall: Trash2,
  update: RefreshCw,
  activate: Power,
  deactivate: PowerOff,
  favorite: Heart,
  unfavorite: Heart,
  loadout_activate: Layers,
  loadout_save: Layers,
  settings_change: Settings,
};

const actionColors: Record<ActivityAction, string> = {
  install: "text-success",
  uninstall: "text-destructive",
  update: "text-info",
  activate: "text-success",
  deactivate: "text-muted-foreground",
  favorite: "text-red-500",
  unfavorite: "text-muted-foreground",
  loadout_activate: "text-primary",
  loadout_save: "text-primary",
  settings_change: "text-muted-foreground",
};

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  const date = new Date(ts);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ActivityFeedProps {
  className?: string;
}

export function ActivityFeed({ className = "" }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  const refresh = useCallback(() => setActivities(listActivities()), []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Recent Activity
        </h3>
        {activities.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearActivities}
            className="text-muted-foreground"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-0.5">
            {activities.slice(0, 50).map((entry) => {
              const Icon = actionIcons[entry.action];
              const color = actionColors[entry.action];
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors"
                >
                  <div className={`mt-0.5 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">
                        {actionLabel(entry.action)}
                      </span>
                      {entry.modName && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {entry.modName}
                        </span>
                      )}
                    </p>
                    {entry.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.detail}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
