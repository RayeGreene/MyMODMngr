import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  listNxmHandoffs,
  ingestNxmHandoff,
  type ApiNxmHandoffSummary,
} from "../lib/api";
import { createNxmProgressController } from "../lib/nxmHelpers";

interface NxmBackgroundListenerProps {
  enabled: boolean;
  onModAdded?: () => Promise<void> | void;
  isHandoffExcluded?: (handoff: ApiNxmHandoffSummary) => boolean;
}

/**
 * Background listener that continuously monitors for NXM handoffs
 * and automatically processes them without user interaction
 */
export function NxmBackgroundListener({
  enabled,
  onModAdded,
  isHandoffExcluded,
}: NxmBackgroundListenerProps) {
  const processedHandoffsRef = useRef<Set<string>>(new Set());
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const checkAndProcessHandoffs = async () => {
      if (cancelled) return;

      try {
        const handoffs = await listNxmHandoffs();

        for (const handoff of handoffs) {
          // Skip if already processed or currently processing
          if (
            processedHandoffsRef.current.has(handoff.id) ||
            processingRef.current.has(handoff.id)
          ) {
            continue;
          }

          // Skip if this handoff is being managed by the update flow
          if (isHandoffExcluded?.(handoff)) {
            continue;
          }

          // Mark as processing to prevent duplicate processing
          processingRef.current.add(handoff.id);

          // Process this handoff in the background
          void processHandoff(handoff);
        }
      } catch (err) {
        console.warn("[NxmBackgroundListener] Failed to list handoffs:", err);
      }

      // Schedule next check
      if (!cancelled) {
        timeoutId = window.setTimeout(checkAndProcessHandoffs, 2000);
      }
    };

    const processHandoff = async (handoff: ApiNxmHandoffSummary) => {
      const modLabel =
        handoff.request?.mod_id != null
          ? `Mod #${handoff.request.mod_id}`
          : "Nexus download";

      const controller = createNxmProgressController(handoff.id, {
        label: `Auto-downloading ${modLabel}`,
        initialMessage: "Processing Nexus handoff...",
      });

      try {
        const ingest = await ingestNxmHandoff(handoff.id, {
          activate: false,
          deactivateExisting: false,
        });

        controller.stop();

        const modName =
          typeof ingest.mod_name === "string" && ingest.mod_name.trim()
            ? ingest.mod_name
            : `Mod #${ingest.mod_id}`;

        const fileName =
          ingest.selected_file &&
          typeof ingest.selected_file["name"] === "string"
            ? (ingest.selected_file["name"] as string)
            : undefined;

        toast.success(`Auto-added ${modName}`, {
          id: controller.toastId,
          description: fileName ?? controller.getLastDescription(),
          duration: 4000,
        });

        if (ingest.activation_warning) {
          toast.warning(ingest.activation_warning);
        }

        // Mark as successfully processed
        processedHandoffsRef.current.add(handoff.id);
        processingRef.current.delete(handoff.id);

        // Notify parent component
        if (onModAdded) {
          await onModAdded();
        }
      } catch (err) {
        controller.stop();

        const errorMessage =
          err instanceof Error ? err.message : String(err ?? "Unknown error");

        toast.error(`Failed to auto-process ${modLabel}`, {
          id: controller.toastId,
          description: errorMessage,
          duration: 5000,
        });

        console.error(
          `[NxmBackgroundListener] Failed to process handoff ${handoff.id}:`,
          err
        );

        // Remove from processing set but don't mark as processed
        // so it can be retried later if needed
        processingRef.current.delete(handoff.id);
      }
    };

    // Start checking
    void checkAndProcessHandoffs();

    return () => {
      cancelled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [enabled, onModAdded]);

  // This component doesn't render anything
  return null;
}
