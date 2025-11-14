import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import "../styles/server-startup-overlay.css";

interface ServerStartupOverlayProps {
  visible: boolean;
  lastError?: string | null;
}

export function ServerStartupOverlay({
  visible,
  lastError,
}: ServerStartupOverlayProps) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (visible) {
      document.body.classList.add("server-startup-lock");
      return () => {
        document.body.classList.remove("server-startup-lock");
      };
    }

    document.body.classList.remove("server-startup-lock");
    return undefined;
  }, [visible]);

  if (!visible) {
    return null;
  }

  const trimmedError = lastError?.trim();
  const showLastError = Boolean(trimmedError);

  const overlayContent = (
    <div className="server-startup-backdrop">
      <div className="server-startup-container">
        <div className="server-startup-glow" aria-hidden="true" />
        <div className="server-startup-dialog text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>

          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
            Launching RivalNxt backend
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Please keep the app open while we bring the local server online. We
            will continue automatically as soon as it responds.
          </p>

          <div className="server-startup-progress" />

          {showLastError ? (
            <div className="server-startup-message server-startup-message-warning rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-xs text-amber-500">
              <p className="font-semibold uppercase tracking-wide">
                Latest message
              </p>
              <p className="mt-1 break-words text-amber-400/90">
                {trimmedError}
              </p>
            </div>
          ) : (
            <p className="server-startup-message text-xs text-muted-foreground">
              This may take a moment after launching for the first time.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return overlayContent;
  }

  return createPortal(overlayContent, document.body);
}
