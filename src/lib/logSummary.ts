import type { SettingsTask } from "./api";

export type StepStatus = "pending" | "active" | "done";

export interface ParsedStep {
  id: string;
  label: string;
  status: StepStatus;
  current?: number;
  total?: number;
  detail?: string;
}

export interface ParsedSummary {
  supported: boolean;
  steps: ParsedStep[];
}

interface ConflictCounts {
  total?: number;
  active?: number;
}

export function summarizeTaskOutput(
  task: SettingsTask | undefined,
  raw: string
): ParsedSummary {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { supported: false, steps: [] };
  }

  if (!task || task === "bootstrap_rebuild") {
    return summarizeBootstrap(trimmed);
  }

  if (task === "ingest_download_assets") {
    return summarizeIngest(trimmed);
  }

  if (task === "scan_active_mods") {
    return summarizeActiveScan(trimmed);
  }

  if (task === "rebuild_conflicts") {
    return summarizeConflicts(trimmed);
  }

  if (task === "rebuild_tags") {
    return summarizeTags(trimmed);
  }

  if (task === "sync_nexus") {
    return summarizeSync(trimmed);
  }

  return { supported: false, steps: [] };
}

function summarizeBootstrap(raw: string): ParsedSummary {
  const lines = splitLines(raw);

  let databaseStatus: StepStatus = "pending";
  let downloadsStatus: StepStatus = "pending";
  let syncStatus: StepStatus = "pending";
  let extractionStatus: StepStatus = "pending";
  let tagsStatus: StepStatus = "pending";
  let conflictsStatus: StepStatus = "pending";
  let conflictCounts: ConflictCounts | null = null;

  let ueExtractionStatus: StepStatus = "pending";
  let ueExtractionDetail: string | undefined;

  let downloadsTotal: number | null = null;
  let syncTotal: number | null = null;
  let extractionTotal: number | null = null;

  let syncCurrent = 0;
  let extractionCurrent = 0;
  const seenExtractionPaths = new Set<string>();

  const seenSyncMods = new Set<string>();
  const seenExtractionTargets = new Set<string>();

  lines.forEach((line) => {
    if (!line) return;

    if (matches(line, /database (location|file)/i)) {
      databaseStatus = "done";
      return;
    }

    const foundDownloads = matchNumber(
      line,
      /(found|scanned)\s+(\d+)\s+(?:local\s+)?download row\(s\)/i
    );
    if (foundDownloads !== null) {
      downloadsTotal = foundDownloads;
      downloadsStatus = "done";
      if (extractionTotal === null) {
        extractionTotal = foundDownloads;
      }
      if (syncTotal === null) {
        syncTotal = foundDownloads;
      }
      return;
    }

    const foundMods = matchNumber(line, /found\s+(\d+)\s+mod\(s\)/i);
    if (foundMods !== null && downloadsTotal === null) {
      downloadsTotal = foundMods;
      downloadsStatus = "done";
      if (extractionTotal === null) {
        extractionTotal = foundMods;
      }
      if (syncTotal === null) {
        syncTotal = foundMods;
      }
      return;
    }

    const syncedModId = matchNumber(line, /synced mod\s+([0-9]+)/i);
    if (syncedModId !== null) {
      const key = `${syncedModId}`;
      if (!seenSyncMods.has(key)) {
        seenSyncMods.add(key);
        syncCurrent = seenSyncMods.size;
      }
      syncStatus = "active";
      return;
    }

    const syncedSummary = matchNumber(line, /synced\s+(\d+)\s+mod\(s\)/i);
    if (syncedSummary !== null) {
      syncTotal = syncedSummary;
      syncCurrent = Math.max(syncCurrent, syncTotal);
      syncStatus = "done";
      return;
    }

    // Match the bracketed name that appears immediately before the extract
    // keywords. Logs include a logger tag earlier (e.g. [ingest_download_assets])
    // so prefer the last bracketed token closest to the keyword.
    if (
      matches(
        line,
        /.*\[(.*?)\]\s+(extracting archive|processing folder|processing download)/i
      )
    ) {
      const name = extractBracketName(line);
      if (name && !seenExtractionTargets.has(name)) {
        seenExtractionTargets.add(name);
        extractionCurrent = seenExtractionTargets.size;
      }
      extractionStatus = "active";
      return;
    }

    // More robust extraction detection: also accept lines that include a bracketed
    // extract event with a path ("[Name] Extracting archive -> C:\path\...")
    // or plain "Processing folder (already extracted) -> C:\path\..." lines.
    // Ensure we capture the bracketed archive name that appears closest to
    // the "Extracting archive" token by allowing a greedy prefix up to the
    // last '[' before the keyword.
    const bracketExtract = line.match(
      /.*\[(.*?)\]\s+Extracting archive\s*->\s*(.+)/i
    );
    if (bracketExtract) {
      const name = bracketExtract[1]?.trim();
      const path = bracketExtract[2]?.trim();
      if (name && !seenExtractionTargets.has(name)) {
        seenExtractionTargets.add(name);
        extractionCurrent = seenExtractionTargets.size;
      } else if (path) {
        const key = path.toLowerCase();
        if (!seenExtractionPaths.has(key)) {
          seenExtractionPaths.add(key);
          extractionCurrent = Math.max(
            extractionCurrent,
            seenExtractionTargets.size + seenExtractionPaths.size
          );
        }
      }
      extractionStatus = "active";
      return;
    }

    const folderExtract = line.match(
      /Processing folder \(already extracted\)\s*->\s*(.+)/i
    );
    if (folderExtract) {
      const path = folderExtract[1]?.trim();
      if (path) {
        const key = path.toLowerCase();
        if (!seenExtractionPaths.has(key)) {
          seenExtractionPaths.add(key);
          extractionCurrent = Math.max(
            extractionCurrent,
            seenExtractionTargets.size + seenExtractionPaths.size
          );
        }
      }
      extractionStatus = "active";
      return;
    }

    const extractionSummary = matchNumber(
      line,
      /processed\s+(\d+)\s+archive\(s\)/i
    );
    if (extractionSummary !== null) {
      extractionTotal = extractionSummary;
      extractionStatus = "done";
      return;
    }

    if (
      matches(
        line,
        /rebuilding (asset_tags|pak_tags)|tagged \d+|tag rebuild complete|tag artifacts rebuilt/i
      )
    ) {
      tagsStatus = /tag rebuild complete|tag artifacts rebuilt/i.test(line)
        ? "done"
        : tagsStatus === "pending"
        ? "active"
        : tagsStatus;
      return;
    }

    if (
      matches(
        line,
        /conflict tables rebuilt|Active scan: discovered|Scanning installed mods/i
      )
    ) {
      conflictsStatus = /conflict tables rebuilt/i.test(line)
        ? "done"
        : conflictsStatus === "pending"
        ? "active"
        : conflictsStatus;
      conflictCounts = mergeConflictCounts(
        conflictCounts,
        extractConflictCounts(line)
      );
      return;
    }

    // Marvel Rivals Extraction
    if (matches(line, /\[1\/4\]|Extracting character names/i)) {
      ueExtractionStatus = "active";
      ueExtractionDetail = "Step 1/4: Extracting characters...";
      return;
    }
    if (matches(line, /\[2\/4\]|Extracting skin ids/i)) {
      ueExtractionStatus = "active";
      ueExtractionDetail = "Step 2/4: Scanning skin variants...";
      return;
    }
    if (matches(line, /\[3\/4\]|Extracting skin names/i)) {
      ueExtractionStatus = "active";
      ueExtractionDetail = "Step 3/4: Reading localization...";
      return;
    }
    if (matches(line, /\[4\/4\]|Building final database/i)) {
      ueExtractionStatus = "active";
      ueExtractionDetail = "Step 4/4: Finalizing database...";
      return;
    }
    if (
      matches(line, /EXTRACTION AND INGESTION COMPLETE!|Total characters:/i)
    ) {
      ueExtractionStatus = "done";
      ueExtractionDetail = "Extraction complete";
      return;
    }
  });

  if (syncStatus === "pending" && syncCurrent > 0) {
    syncStatus = "active";
  }
  if (
    syncStatus === "active" &&
    syncTotal !== null &&
    syncCurrent >= syncTotal
  ) {
    syncStatus = "done";
  }

  if (extractionStatus === "pending" && extractionCurrent > 0) {
    extractionStatus = "active";
  }
  const extractionTargetTotal =
    extractionTotal !== null
      ? extractionTotal
      : downloadsTotal !== null
      ? downloadsTotal
      : seenExtractionTargets.size > 0
      ? seenExtractionTargets.size
      : null;
  if (
    extractionStatus === "active" &&
    extractionTargetTotal !== null &&
    extractionCurrent >= extractionTargetTotal
  ) {
    extractionStatus = "done";
  }

  const steps: ParsedStep[] = [];

  if (databaseStatus !== "pending") {
    steps.push({
      id: "database",
      label: "Database location found",
      status: databaseStatus,
    });
  }

  if (ueExtractionStatus !== "pending") {
    steps.push({
      id: "ue_extraction",
      label: "Game Data Extraction",
      status: ueExtractionStatus,
      detail: ueExtractionDetail,
    });
  }

  if (downloadsStatus !== "pending" && downloadsTotal !== null) {
    steps.push({
      id: "downloads",
      label: `Found ${downloadsTotal} mods`,
      status: downloadsStatus,
    });
  }

  if (syncStatus !== "pending") {
    const total = syncTotal ?? downloadsTotal ?? null;
    steps.push({
      id: "sync",
      label: syncStatus === "done" ? "Synced mods" : "Syncing mods",
      status: syncStatus,
      current:
        syncCurrent || (syncStatus === "done" && total ? total : undefined),
      total: total ?? undefined,
    });
  }

  if (extractionStatus !== "pending") {
    steps.push({
      id: "extract",
      label: extractionStatus === "done" ? "Extracted mods" : "Extracting mods",
      status: extractionStatus,
      current:
        extractionCurrent ||
        (extractionStatus === "done" && extractionTargetTotal
          ? extractionTargetTotal
          : undefined),
      total: extractionTargetTotal ?? undefined,
    });
  }

  if (tagsStatus !== "pending") {
    steps.push({
      id: "tags",
      label: "Building tags",
      status: tagsStatus,
    });
  }

  if (conflictsStatus !== "pending") {
    steps.push({
      id: "conflicts",
      label: "Examining conflicts",
      status: conflictsStatus,
      detail: formatConflictDetail(conflictCounts),
    });
  }

  return {
    supported: steps.length > 0,
    steps,
  };
}

function summarizeIngest(raw: string): ParsedSummary {
  const lines = splitLines(raw);
  let total: number | null = null;
  let processed = 0;
  let sawCompletionLine = false;
  const seen = new Set<string>();
  const seenArchivePaths = new Set<string>();

  lines.forEach((line) => {
    const found = matchNumber(line, /found\s+(\d+)\s+download row\(s\)/i);
    if (found !== null) {
      total = found;
      return;
    }

    // If the script prints a processed summary line, prefer it as final value
    if (matches(line, /processed\s+\d+\s+archive/i)) {
      const summary = matchNumber(line, /processed\s+(\d+)\s+archive/i);
      if (summary !== null) {
        processed = summary;
      }
      sawCompletionLine = true;
      return;
    }

    // Look for explicit extraction/processing lines. Prefer a bracketed name when
    // available ("[Name] Extracting archive -> path"); otherwise extract the path
    // and use the basename as a stable key to avoid double-counting.
    // For ingest logs also capture the bracketed name closest to the keyword
    const bracketExtract = line.match(
      /.*\[(.*?)\]\s+Extracting archive\s*->\s*(.+)/i
    );
    if (bracketExtract) {
      const name = bracketExtract[1]?.trim();
      const path = bracketExtract[2]?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        processed = seen.size;
        return;
      }
      if (path) {
        const key = path.toLowerCase();
        if (!seenArchivePaths.has(key)) {
          seenArchivePaths.add(key);
          processed = Math.max(processed, seen.size + seenArchivePaths.size);
        }
        return;
      }
    }

    // Fallback: processing folder lines without bracketed name
    const folderExtract = line.match(
      /Processing folder \(already extracted\)\s*->\s*(.+)/i
    );
    if (folderExtract) {
      const path = folderExtract[1]?.trim();
      if (path) {
        const key = path.toLowerCase();
        if (!seenArchivePaths.has(key)) {
          seenArchivePaths.add(key);
          processed = Math.max(processed, seen.size + seenArchivePaths.size);
        }
      }
      return;
    }

    // If the script logs "Found X pak(s) in archive" the log is usually prefixed
    // by the bracketed name as well; try to use that to increment progress.
    if (matches(line, /Found\s+\d+\s+pak\(s\) in archive/i)) {
      const name = extractBracketName(line);
      if (name && !seen.has(name)) {
        seen.add(name);
        processed = seen.size;
      } else {
        // No bracket name available; bump using archive path set size
        processed = Math.max(processed, seen.size + seenArchivePaths.size);
      }
      return;
    }
  });

  if (processed === 0 && total === null) {
    return { supported: false, steps: [] };
  }

  const completed =
    total !== null ? processed >= total && total >= 0 : sawCompletionLine;
  const status: StepStatus = completed ? "done" : "active";
  const label = status === "done" ? "Extracted mods" : "Extracting mods";

  const boundedProcessed =
    total !== null ? Math.min(processed, total) : processed;

  const detail = (() => {
    if (total !== null) {
      return `Processed ${boundedProcessed} of ${total} archive(s)`;
    }
    if (sawCompletionLine) {
      return boundedProcessed > 0
        ? `Processed ${boundedProcessed} archive(s)`
        : "No archives required processing";
    }
    return boundedProcessed > 0
      ? `Processed ${boundedProcessed} archive(s)`
      : undefined;
  })();

  return {
    supported: true,
    steps: [
      {
        id: "ingest",
        label,
        status,
        current: boundedProcessed || undefined,
        total: total ?? undefined,
        detail,
      },
    ],
  };
}

function summarizeActiveScan(raw: string): ParsedSummary {
  const lines = splitLines(raw);
  const scanLine = lines.find((line) =>
    matches(line, /active scan: discovered/i)
  );
  if (!scanLine) {
    return { supported: false, steps: [] };
  }

  const count = matchNumber(scanLine, /discovered\s+(\d+)/i);
  return {
    supported: true,
    steps: [
      {
        id: "scan",
        label:
          count !== null
            ? `Active scan found ${count} pak(s)`
            : "Scanning active mods",
        status: "done",
      },
    ],
  };
}

function summarizeConflicts(raw: string): ParsedSummary {
  const lines = splitLines(raw);
  if (lines.length === 0) {
    return { supported: false, steps: [] };
  }

  let status: StepStatus = "pending";
  let counts: ConflictCounts | null = null;

  lines.forEach((line) => {
    if (!line) return;
    if (matches(line, /rebuild results/i)) {
      status = "done";
      counts = mergeConflictCounts(counts, extractConflictCounts(line));
      return;
    }
    if (matches(line, /conflict tables rebuilt/i)) {
      status = "done";
      counts = mergeConflictCounts(counts, extractConflictCounts(line));
      return;
    }
    // Newer output prints asset_conflicts counts on separate lines; capture them
    if (
      matches(line, /asset_conflicts\s*:\s*\d+/i) ||
      matches(line, /asset_conflicts_active\s*:\s*\d+/i)
    ) {
      counts = mergeConflictCounts(counts, extractConflictCounts(line));
      return;
    }
    // Mark done when the task prints a finished line with exit code 0
    const finishedMatch = line.match(/finished with exit code\s*(\d+)/i);
    if (finishedMatch) {
      const code = parseInt(finishedMatch[1] ?? "", 10);
      if (Number.isFinite(code) && code === 0) {
        status = "done";
      } else {
        // non-zero exit still indicates task finished; mark active -> done so UI stops spinner
        status = "done";
      }
      // try to extract counts from the same line if present
      counts = mergeConflictCounts(counts, extractConflictCounts(line));
      return;
    }
    if (status !== "done") {
      if (
        matches(line, /rebuild conflicts/i) ||
        matches(line, /sample asset_conflicts/i) ||
        matches(line, /active conflicts/i) ||
        matches(line, /examining conflicts/i)
      ) {
        status = "active";
      }
    }
  });

  if (status === "pending" && lines.length > 0) {
    status = "active";
  }

  if (status === "pending") {
    return { supported: false, steps: [] };
  }

  return {
    supported: true,
    steps: [
      {
        id: "conflicts",
        label: "Examining conflicts",
        status,
        detail: formatConflictDetail(counts),
      },
    ],
  };
}

function summarizeTags(raw: string): ParsedSummary {
  const lines = splitLines(raw);
  const tagged = lines.find((line) => matches(line, /tagged \d+/i));
  if (!tagged) {
    return { supported: false, steps: [] };
  }
  const count = matchNumber(tagged, /tagged\s+(\d+)/i);
  return {
    supported: true,
    steps: [
      {
        id: "tags",
        label:
          count !== null ? `Tagged ${count} asset path(s)` : "Building tags",
        status: "done",
      },
    ],
  };
}

function summarizeSync(raw: string): ParsedSummary {
  const lines = splitLines(raw);
  let total: number | null = null;
  let current = 0;
  const seen = new Set<string>();

  lines.forEach((line) => {
    const summary = matchNumber(line, /synced\s+(\d+)\s+mod\(s\)/i);
    if (summary !== null) {
      total = summary;
      current = Math.max(current, total);
      return;
    }
    if (matches(line, /synced mod\s+[0-9]+/i)) {
      const id = extractMatch(line, /synced mod\s+([0-9]+)/i);
      if (id && !seen.has(id)) {
        seen.add(id);
        current = seen.size;
      }
    }
  });

  if (current === 0 && total === null) {
    return { supported: false, steps: [] };
  }

  const status: StepStatus =
    total !== null && current >= total ? "done" : "active";
  const label = status === "done" ? "Synced mods" : "Syncing mods";

  return {
    supported: true,
    steps: [
      {
        id: "sync",
        label,
        status,
        current: current || undefined,
        total: total ?? undefined,
      },
    ],
  };
}

function mergeConflictCounts(
  existing: ConflictCounts | null,
  incoming: ConflictCounts | null
): ConflictCounts | null {
  if (!incoming) return existing;
  if (!existing) return { ...incoming };
  const merged: ConflictCounts = { ...existing };
  if (typeof incoming.total === "number") {
    merged.total = incoming.total;
  }
  if (typeof incoming.active === "number") {
    merged.active = incoming.active;
  }
  return merged;
}

function formatConflictDetail(
  counts: ConflictCounts | null
): string | undefined {
  if (!counts) return undefined;
  const parts: string[] = [];
  if (typeof counts.total === "number") {
    parts.push(`${counts.total} total`);
  }
  if (typeof counts.active === "number") {
    parts.push(`${counts.active} active`);
  }
  if (parts.length === 0) return undefined;
  return `Conflicts: ${parts.join(" · ")}`;
}

function extractConflictCounts(line: string): ConflictCounts | null {
  const totalMatch = line.match(/asset_conflicts["']?\s*:\s*(\d+)/i);
  const activeMatch = line.match(/asset_conflicts_active["']?\s*:\s*(\d+)/i);
  if (!totalMatch && !activeMatch) {
    return null;
  }
  const counts: ConflictCounts = {};
  if (totalMatch) {
    const parsed = parseInt(totalMatch[1] ?? "", 10);
    if (Number.isFinite(parsed)) {
      counts.total = parsed;
    }
  }
  if (activeMatch) {
    const parsed = parseInt(activeMatch[1] ?? "", 10);
    if (Number.isFinite(parsed)) {
      counts.active = parsed;
    }
  }
  return counts;
}

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function matches(line: string, pattern: RegExp): boolean {
  return pattern.test(line);
}

function matchNumber(line: string, pattern: RegExp): number | null {
  const match = line.match(pattern);
  if (!match) return null;
  const value = parseInt(match[match.length - 1] ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function extractBracketName(line: string): string | null {
  // Return the last bracketed token on the line. Many log lines include an
  // earlier logger tag like `[ingest_download_assets]` followed by the
  // archive name in a second bracket; prefer the archive name.
  const matches = Array.from(line.matchAll(/\[(.*?)\]/g));
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return last && last[1] ? last[1].trim() : null;
}

function extractMatch(line: string, pattern: RegExp): string | null {
  const match = line.match(pattern);
  if (!match) return null;
  return match[1]?.trim() ?? null;
}
