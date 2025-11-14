import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Check, Loader2, Circle } from "lucide-react";

import type { SettingsTask } from "../lib/api";
import { summarizeTaskOutput } from "../lib/logSummary";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { cn } from "./ui/utils";

interface TaskOutputSummaryProps {
  task?: SettingsTask;
  output: string;
  isRunning?: boolean;
  fallbackMinHeight?: string;
  showRawToggle?: boolean;
}

export function TaskOutputSummary({
  task,
  output,
  isRunning = false,
  fallbackMinHeight = "h-40",
  showRawToggle = true,
}: TaskOutputSummaryProps) {
  const trimmed = output?.trim() ?? "";
  const [showRaw, setShowRaw] = useState(false);

  const summary = useMemo(() => {
    // Try primary task first, then fall back to other known task types when
    // the primary parser doesn't recognize the log. This helps when a
    // wrapper task (like bootstrap_rebuild) streams logs from subtasks
    // such as ingest_download_assets — ensure we still detect progress.
    const primary = summarizeTaskOutput(task, trimmed);
    if (primary.supported) return primary;

    const candidates: (SettingsTask | undefined)[] = [
      "ingest_download_assets",
      "bootstrap_rebuild",
      "rebuild_conflicts",
      "rebuild_tags",
      "sync_nexus",
      undefined,
    ];

    for (const cand of candidates) {
      if (cand === task) continue;
      const s = summarizeTaskOutput(cand, trimmed);
      if (s.supported) return s;
    }

    return primary;
  }, [task, trimmed]);

  if (!trimmed) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed border-border/40 bg-muted/5 p-4 text-sm text-muted-foreground",
          fallbackMinHeight
        )}
      >
        {isRunning ? "Waiting for output…" : "No output captured."}
      </div>
    );
  }

  if (!summary.supported || summary.steps.length === 0) {
    return (
      <Textarea
        readOnly
        className={cn("resize-y font-mono text-xs", fallbackMinHeight)}
        value={trimmed}
        spellCheck={false}
      />
    );
  }

  const progressRows = summary.steps.map((step) => {
    const statusClass =
      step.status === "done"
        ? "text-emerald-500"
        : step.status === "active"
        ? "text-primary"
        : "text-muted-foreground";

    const total =
      typeof step.total === "number" && step.total > 0 ? step.total : undefined;

    let current =
      typeof step.current === "number" && step.current >= 0
        ? step.current
        : undefined;

    if (typeof current === "number" && typeof total === "number") {
      current = Math.min(current, total);
    } else if (
      typeof total === "number" &&
      current === undefined &&
      step.status === "done"
    ) {
      current = total;
    }

    const hasCurrent = typeof current === "number";
    const hasTotal = typeof total === "number";
    const showCounts = hasCurrent || hasTotal;
    let prefixText: string | undefined;
    if (showCounts) {
      if (hasCurrent && hasTotal) {
        prefixText = `(${current as number}/${total})`;
      } else if (hasCurrent) {
        prefixText = `(${current as number})`;
      } else if (hasTotal) {
        const fallbackCurrent = step.status === "done" ? total : 0;
        prefixText = `(${fallbackCurrent}/${total})`;
      }
    }

    const labelText = prefixText ? `${prefixText} ${step.label}` : step.label;

    let indicator: ReactNode;
    if (step.status === "done") {
      indicator = <Check className="h-4 w-4 text-emerald-500" aria-hidden />;
    } else if (step.status === "active") {
      indicator = (
        <Loader2
          className="h-3.5 w-3.5 animate-spin text-primary"
          aria-hidden
        />
      );
    } else {
      indicator = (
        <Circle className="h-3 w-3 text-muted-foreground" aria-hidden />
      );
    }

    return (
      <div
        key={step.id}
        className="flex flex-col gap-1 text-sm leading-relaxed"
      >
        <div className="flex items-center gap-2">
          {indicator}
          <span className={cn(statusClass, "tabular-nums")}>{labelText}</span>
        </div>
        {step.detail ? (
          <span className="ml-6 text-xs text-muted-foreground">
            {step.detail}
          </span>
        ) : null}
      </div>
    );
  });

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/40 bg-muted/5 p-4">
        <div className="flex flex-col gap-2">{progressRows}</div>
      </div>

      {showRawToggle ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Raw log available for diagnostics.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowRaw((prev) => !prev)}
          >
            {showRaw ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" /> Hide raw log
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" /> Show raw log
              </>
            )}
          </Button>
        </div>
      ) : null}

      {showRawToggle && showRaw ? (
        <Textarea
          readOnly
          className={cn("resize-y font-mono text-xs", fallbackMinHeight)}
          value={trimmed}
          spellCheck={false}
        />
      ) : null}
    </div>
  );
}
