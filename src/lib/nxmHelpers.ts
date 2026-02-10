import { toast } from "sonner";

import {
  listNxmHandoffs,
  getNxmHandoff,
  type ApiNxmHandoffSummary,
  type ApiNxmDownloadProgress,
  ApiError,
} from "./api";

export type WaitForHandoffOptions = {
  timeoutMs?: number;
};

export function formatBytes(size?: number | null): string {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1
  );
  const value = size / Math.pow(1024, exponent);
  const precision = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[exponent]}`;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function waitForMatchingHandoff(
  modId: number,
  fileId: number | null,
  options: WaitForHandoffOptions = {}
): Promise<ApiNxmHandoffSummary | null> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const deadline = Date.now() + timeoutMs;

  const tryFindMatch = async (): Promise<ApiNxmHandoffSummary | null> => {
    let handoffs: ApiNxmHandoffSummary[] = [];
    try {
      handoffs = await listNxmHandoffs();
    } catch (err) {
      console.warn("Failed to list Nexus handoffs", err);
      return null;
    }
    if (handoffs.length === 0) return null;

    const matches = handoffs.filter((handoff) => {
      if (handoff.consumed) return false;
      const request = handoff.request;
      const requestModId = parseNumber(request?.mod_id);
      if (requestModId !== modId) return false;
      if (fileId == null) return true;
      const requestFileId = parseNumber(request?.file_id);
      if (requestFileId == null) return false;
      return requestFileId === fileId;
    });

    if (matches.length === 0) return null;
    const sorted = [...matches].sort(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
    );
    return sorted[0];
  };

  // Adaptive polling: slow at start (user is switching to browser),
  // faster in the middle, rapid near the deadline to avoid near-misses.
  while (Date.now() < deadline) {
    const match = await tryFindMatch();
    if (match) return match;

    const remaining = deadline - Date.now();
    let intervalMs: number;
    if (remaining > 60_000) {
      // First ~30s: user is loading the Nexus page — poll every 2.5s
      intervalMs = 2_500;
    } else if (remaining > 15_000) {
      // Middle phase: user likely clicking soon — poll every 1.5s
      intervalMs = 1_500;
    } else {
      // Final 15s: rapid polling to catch near-miss handoffs
      intervalMs = 750;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  // One final grace check after the deadline — catches handoffs that arrived
  // during the last sleep interval.
  return tryFindMatch();
}

export type MonitorNxmProgressOptions = {
  pollIntervalMs?: number;
  onError?: (error: unknown) => void;
};

export type MonitorNxmProgressHandle = {
  stop: () => void;
};

export function monitorNxmDownloadProgress(
  handoffId: string,
  onUpdate: (
    progress: ApiNxmDownloadProgress | null,
    meta: { done: boolean }
  ) => void,
  options: MonitorNxmProgressOptions = {}
): MonitorNxmProgressHandle {
  if (typeof window === "undefined") {
    return { stop: () => undefined };
  }

  let cancelled = false;
  let timer: number | null = null;

  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const poll = async () => {
    if (cancelled) return;
    try {
      const response = await getNxmHandoff(handoffId);
      const progress = response?.handoff?.progress ?? null;
      onUpdate(progress, { done: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        onUpdate(null, { done: true });
        stop();
        return;
      }
      options.onError?.(err);
    }
  };

  void poll();
  const interval = Math.max(250, options.pollIntervalMs ?? 750);
  timer = window.setInterval(() => {
    void poll();
  }, interval);

  return { stop };
}

export type NxmProgressController = {
  toastId: string | number;
  stop: () => void;
  getLastDescription: () => string;
};

export type CreateProgressControllerOptions = {
  label?: string;
  initialMessage?: string;
  pollIntervalMs?: number;
};

export function createNxmProgressController(
  handoffId: string,
  options: CreateProgressControllerOptions = {}
): NxmProgressController {
  const label = options.label ?? "Downloading mod…";
  let lastDescription = options.initialMessage ?? "Preparing download…";
  const toastId = toast.loading(label, {
    description: lastDescription,
    duration: Infinity,
  });

  let active = true;

  const handleUpdate = (
    progress: ApiNxmDownloadProgress | null,
    meta: { done: boolean }
  ) => {
    if (!active) return;
    if (!progress) {
      if (meta.done && !lastDescription) {
        lastDescription = "Download finished";
      }
      return;
    }

    const parts: string[] = [];
    if (
      typeof progress.percent === "number" &&
      Number.isFinite(progress.percent)
    ) {
      parts.push(`${Math.round(progress.percent)}%`);
    }
    if (typeof progress.bytes_downloaded === "number") {
      if (
        typeof progress.bytes_total === "number" &&
        Number.isFinite(progress.bytes_total) &&
        progress.bytes_total > 0
      ) {
        parts.push(
          `${formatBytes(progress.bytes_downloaded)} / ${formatBytes(
            progress.bytes_total
          )}`
        );
      } else {
        parts.push(formatBytes(progress.bytes_downloaded));
      }
    }
    if (progress.message) {
      parts.push(progress.message);
    } else if (progress.stage === "downloading" && parts.length === 0) {
      parts.push("Downloading…");
    }
    if (progress.error) {
      parts.push(progress.error);
    }

    const description =
      parts.join(" · ") || progress.message || lastDescription;
    lastDescription = description;
    toast.loading(label, {
      id: toastId,
      description,
      duration: Infinity,
    });
  };

  const monitor = monitorNxmDownloadProgress(handoffId, handleUpdate, {
    pollIntervalMs: options.pollIntervalMs,
    onError: (error) => {
      if (!active) return;
      console.warn("Failed to poll Nexus handoff progress", error);
    },
  });

  const stop = () => {
    if (!active) return;
    active = false;
    monitor.stop();
  };

  return {
    toastId,
    stop,
    getLastDescription: () => lastDescription,
  };
}
