import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "./ui/utils";

export type NxmHandoffPromptProps = {
  id: string;
  modId?: number | null;
  fileId?: number | null;
  modName?: string | null;
  fileName?: string | null;
  version?: string | null;
  createdAt?: number | null;
  expiresAt?: number | null;
  onAccept: () => void;
  onDismiss: () => void;
  acceptBusy?: boolean;
  dismissBusy?: boolean;
  error?: string | null;
};

function formatDelta(target?: number | null): string | null {
  if (typeof target !== "number" || Number.isNaN(target)) return null;
  const now = Date.now() / 1000;
  const delta = Math.round(target - now);
  if (!Number.isFinite(delta)) return null;
  const abs = Math.abs(delta);
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  const suffix = delta >= 0 ? "remaining" : "ago";
  if (minutes > 0) {
    return `${minutes}m ${seconds}s ${suffix}`;
  }
  return `${seconds}s ${suffix}`;
}

export function NxmHandoffPrompt({
  id,
  modId,
  fileId,
  modName,
  fileName,
  version,
  createdAt,
  expiresAt,
  onAccept,
  onDismiss,
  acceptBusy,
  dismissBusy,
  error,
}: NxmHandoffPromptProps) {
  const expiresText = formatDelta(expiresAt);
  const createdText = formatDelta(createdAt);
  return (
    <Card className="mb-4 border-amber-500/40 bg-amber-500/10 p-4 text-sm shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500 text-amber-50">
              Pending Nexus download
            </Badge>
            {expiresText ? (
              <span className="text-xs text-muted-foreground">
                Expires in {expiresText}
              </span>
            ) : null}
            {createdText ? (
              <span className="text-xs text-muted-foreground">
                Received {createdText}
              </span>
            ) : null}
          </div>
          <div className="text-base font-medium text-foreground">
            {modName || `Mod ${modId ?? "?"}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {fileName || (fileId != null ? `File #${fileId}` : "Unknown file")}
            {version ? ` · v${version}` : null}
            <span className="ml-2 text-muted-foreground/70">
              Handoff ID: {id}
            </span>
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            onClick={onDismiss}
            disabled={dismissBusy}
            className={cn("sm:min-w-[110px]", dismissBusy && "opacity-70")}
          >
            {dismissBusy ? "Dismissing..." : "Dismiss"}
          </Button>
          <Button
            onClick={onAccept}
            disabled={!!error || acceptBusy}
            className={cn("sm:min-w-[150px]", acceptBusy && "opacity-80")}
          >
            {acceptBusy ? "Processing..." : "Download & Activate"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
