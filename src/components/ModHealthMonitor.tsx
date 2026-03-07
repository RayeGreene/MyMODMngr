import { useMemo } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

interface ModHealthMonitorProps {
  mods: any[];
  onUpdate?: (modId: string) => void;
  onView?: (mod: any) => void;
}

type HealthStatus = "healthy" | "warning" | "critical";

interface ModHealth {
  mod: any;
  status: HealthStatus;
  issues: string[];
  score: number; // 0-100
}

function assessModHealth(mod: any): ModHealth {
  const issues: string[] = [];
  let score = 100;

  // Check if mod needs update
  if (mod.hasUpdate) {
    issues.push("Update available");
    score -= 20;
  }

  // Check for missing metadata
  if (!mod.author || mod.author.trim() === "") {
    issues.push("Missing author info");
    score -= 10;
  }

  // Check for no images
  if (!mod.images || mod.images.length === 0 ||
      (mod.images.length === 1 && mod.images[0].includes("pinimg.com"))) {
    issues.push("No custom images");
    score -= 5;
  }

  // Check if mod is inactive but installed
  if (mod.isInstalled && mod.isActive === false) {
    issues.push("Installed but disabled");
    score -= 10;
  }

  // Check for old mods (no update timestamp)
  if (!mod.lastUpdatedRaw && !mod.releaseDate) {
    issues.push("No release date");
    score -= 5;
  }

  // Check for update errors
  if (mod.updateError) {
    issues.push(`Update error: ${mod.updateError}`);
    score -= 30;
  }

  score = Math.max(0, score);
  const status: HealthStatus =
    score >= 80 ? "healthy" : score >= 50 ? "warning" : "critical";

  return { mod, status, issues, score };
}

export function ModHealthMonitor({ mods, onUpdate, onView }: ModHealthMonitorProps) {
  const installedMods = useMemo(
    () => mods.filter((m) => m.isInstalled),
    [mods]
  );

  const healthReports = useMemo(
    () =>
      installedMods
        .map(assessModHealth)
        .sort((a, b) => a.score - b.score),
    [installedMods]
  );

  const healthyCnt = healthReports.filter((h) => h.status === "healthy").length;
  const warningCnt = healthReports.filter((h) => h.status === "warning").length;
  const criticalCnt = healthReports.filter((h) => h.status === "critical").length;
  const avgScore = healthReports.length > 0
    ? Math.round(healthReports.reduce((sum, h) => sum + h.score, 0) / healthReports.length)
    : 100;

  const statusColor = (status: HealthStatus) => {
    switch (status) {
      case "healthy": return "text-emerald-500";
      case "warning": return "text-amber-500";
      case "critical": return "text-destructive";
    }
  };

  const statusIcon = (status: HealthStatus) => {
    switch (status) {
      case "healthy": return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "critical": return <AlertTriangle className="w-4 h-4 text-destructive" />;
    }
  };

  const scoreBarColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-destructive";
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-primary" />
          Mod Health Monitor
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Overall health score: {avgScore}/100
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold">{avgScore}</p>
          <p className="text-xs text-muted-foreground">Average Score</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-emerald-500">{healthyCnt}</p>
          <p className="text-xs text-muted-foreground">Healthy</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{warningCnt}</p>
          <p className="text-xs text-muted-foreground">Warnings</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-destructive">{criticalCnt}</p>
          <p className="text-xs text-muted-foreground">Critical</p>
        </div>
      </div>

      {/* Mod list */}
      {healthReports.length === 0 ? (
        <div className="text-center py-12">
          <HeartPulse className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">No Mods Installed</h3>
          <p className="text-muted-foreground text-sm">
            Install some mods to see health reports.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {healthReports.map((report) => (
            <div
              key={report.mod.id}
              className="bg-card border border-border rounded-lg p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
            >
              {statusIcon(report.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {report.mod.name}
                  </p>
                  <Badge variant="outline" className={`text-[10px] ${statusColor(report.status)}`}>
                    {report.score}/100
                  </Badge>
                </div>
                {report.issues.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    {report.issues.join(" · ")}
                  </p>
                )}
                {/* Score bar */}
                <div className="mt-1.5 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${scoreBarColor(report.score)}`}
                    style={{ width: `${report.score}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {report.mod.hasUpdate && onUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => onUpdate(report.mod.id)}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Update
                  </Button>
                )}
                {onView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onView(report.mod)}
                  >
                    View
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
