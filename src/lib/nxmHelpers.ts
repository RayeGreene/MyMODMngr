import { listNxmHandoffs, type ApiNxmHandoffSummary } from "./api";

export type WaitForHandoffOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

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
  const timeoutMs = options.timeoutMs ?? 45_000;
  const intervalMs = options.intervalMs ?? 1_500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let handoffs: ApiNxmHandoffSummary[] = [];
    try {
      handoffs = await listNxmHandoffs();
    } catch (err) {
      console.warn("Failed to list Nexus handoffs", err);
    }

    if (handoffs.length > 0) {
      const matches = handoffs.filter((handoff) => {
        const request = handoff.request;
        const requestModId = parseNumber(request?.mod_id);
        if (requestModId !== modId) return false;
        if (fileId == null) return true;
        const requestFileId = parseNumber(request?.file_id);
        if (requestFileId == null) return false;
        return requestFileId === fileId;
      });

      if (matches.length > 0) {
        const sorted = [...matches].sort(
          (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
        );
        return sorted[0];
      }
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}
