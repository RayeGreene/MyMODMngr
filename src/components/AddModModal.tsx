import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import {
  ApiError,
  addMod,
  uploadModFile,
  ingestNxmHandoff,
  submitNxmHandoff,
  type ApiUploadModResponse,
} from "../lib/api";
import { toast } from "sonner";
import { openInBrowser } from "../lib/tauri-utils";
import {
  waitForMatchingHandoff,
  createNxmProgressController,
  formatBytes,
} from "../lib/nxmHelpers";

interface AddModModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => Promise<void> | void;
}

export function AddModModal({
  open,
  onOpenChange,
  onSuccess,
}: AddModModalProps) {
  const [modLink, setModLink] = useState("");
  const [localPath, setLocalPath] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<ApiUploadModResponse | null>(
    null
  );

  const parseNexusModLink = (raw: string) => {
    try {
      const url = new URL(raw);
      if (!/nexusmods\.com$/i.test(url.hostname)) return null;
      const segments = url.pathname
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
      const modsIndex = segments.findIndex(
        (segment) => segment.toLowerCase() === "mods"
      );
      if (modsIndex <= 0 || modsIndex + 1 >= segments.length) {
        return null;
      }
      const game = segments[modsIndex - 1];
      const modIdValue = Number.parseInt(segments[modsIndex + 1], 10);
      if (!Number.isFinite(modIdValue)) {
        return null;
      }
      let fileId: number | null = null;
      const queryCandidate =
        url.searchParams.get("file_id") ?? url.searchParams.get("fileId");
      if (queryCandidate) {
        const parsed = Number.parseInt(queryCandidate, 10);
        if (Number.isFinite(parsed)) {
          fileId = parsed;
        }
      }
      if (fileId == null) {
        const filesIndex = segments.findIndex(
          (segment) => segment.toLowerCase() === "files"
        );
        if (filesIndex >= 0 && filesIndex + 1 < segments.length) {
          const parsed = Number.parseInt(segments[filesIndex + 1], 10);
          if (Number.isFinite(parsed)) {
            fileId = parsed;
          }
        }
      }
      return { url, game, modId: modIdValue, fileId };
    } catch (err) {
      return null;
    }
  };

  const resetInputs = () => {
    setModLink("");
    setLocalPath("");
    setUploadInfo(null);
  };

  const handleNxmError = (
    err: unknown,
    context?: string,
    toastId?: string | number
  ): string => {
    let message: string;
    if (err instanceof ApiError) {
      const detail = err.detail;
      if (detail && typeof detail === "object" && detail !== null) {
        const detailMessage = (detail as Record<string, unknown>)["message"];
        if (typeof detailMessage === "string" && detailMessage.trim()) {
          message = detailMessage.trim();
        } else if (typeof err.message === "string" && err.message.trim()) {
          message = err.message.trim();
        } else {
          message = "Nexus handoff failed";
        }
      } else if (err.message) {
        message = err.message;
      } else {
        message = "Nexus handoff failed";
      }
    } else if (err instanceof Error && err.message) {
      message = err.message;
    } else {
      message = String(err ?? "Unknown error");
    }
    const fullMessage = context ? `${context}: ${message}` : message;
    if (toastId != null) {
      toast.error(fullMessage, { id: toastId });
    } else {
      toast.error(fullMessage);
    }
    return fullMessage;
  };

  const finalizeSuccess = async () => {
    resetInputs();
    onOpenChange(false);
    if (onSuccess) {
      await onSuccess();
    }
  };

  const handleDirectNxm = async (nxmUri: string) => {
    setBusy(true);
    try {
      const response = await submitNxmHandoff(nxmUri);
      const handoff = response?.handoff;
      if (!handoff || !handoff.id) {
        toast.error("Backend did not accept the RivalNxt link.");
        return;
      }
      const modLabel =
        (handoff.request?.mod_id != null
          ? `Mod #${handoff.request?.mod_id}`
          : null) ?? "Nexus download";
      const controller = createNxmProgressController(handoff.id, {
        label: `Downloading ${modLabel}`,
      });
      try {
        const ingest = await ingestNxmHandoff(handoff.id, {
          activate: false,
          deactivateExisting: false,
        });
        controller.stop();
        const modName =
          typeof ingest.mod_name === "string" &&
          ingest.mod_name.trim().length > 0
            ? ingest.mod_name
            : `Mod #${ingest.mod_id}`;
        const fileName =
          ingest.selected_file &&
          typeof ingest.selected_file["name"] === "string"
            ? (ingest.selected_file["name"] as string)
            : undefined;
        toast.success(`Added ${modName}`, {
          id: controller.toastId,
          description: fileName ?? controller.getLastDescription(),
        });
        if (ingest.activation_warning) {
          toast.warning(ingest.activation_warning);
        }
        await finalizeSuccess();
      } catch (err) {
        controller.stop();
        handleNxmError(
          err,
          "Failed to process RivalNxt link",
          controller.toastId
        );
      }
    } catch (err) {
      handleNxmError(err, "Failed to process RivalNxt link");
    } finally {
      setBusy(false);
    }
  };

  const handleNexusLink = async (
    details: ReturnType<typeof parseNexusModLink>
  ) => {
    if (!details) return;
    setBusy(true);
    const { url, game, modId, fileId } = details;
    if (fileId == null) {
      toast.error(
        "Nexus link is missing a file id. Copy the specific file's 'Mod Manager Download' link from the Files tab."
      );
      setBusy(false);
      return;
    }
    try {
      const nexusUrl = new URL(url.toString());
      if (!nexusUrl.searchParams.get("tab")) {
        nexusUrl.searchParams.set("tab", "files");
      }
      nexusUrl.searchParams.set("file_id", String(fileId));
      nexusUrl.searchParams.set("nmm", "1");

      const nxmPreview = `nxm://${game}/mods/${modId}/files/${fileId}`;

      toast.info("Opening Nexus Mods to start the RivalNxt handoff", {
        description: `${nxmPreview}`,
      });

      let openedNewTab = false;
      try {
        await openInBrowser(nexusUrl.toString());
        openedNewTab = true;
        console.log("Successfully opened Nexus URL");
      } catch (err) {
        console.error("Failed to open Nexus download page:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        toast.error("Could not open browser", {
          description: errorMessage,
        });
      }

      if (!openedNewTab) {
        setBusy(false);
        return;
      }

      const handoff = await waitForMatchingHandoff(modId, fileId);
      if (!handoff) {
        toast.error(
          "Did not receive a RivalNxt handoff. Approve the download in the Nexus tab, then try again."
        );
        return;
      }

      const modLabel =
        handoff.request?.mod_id != null
          ? `Mod #${handoff.request.mod_id}`
          : "Nexus download";
      const controller = createNxmProgressController(handoff.id, {
        label: `Downloading ${modLabel}`,
      });

      try {
        const ingest = await ingestNxmHandoff(handoff.id, {
          activate: false,
          deactivateExisting: false,
        });
        controller.stop();
        const modName =
          typeof ingest.mod_name === "string" && ingest.mod_name?.trim()
            ? ingest.mod_name
            : `Mod #${ingest.mod_id}`;
        const fileName =
          ingest.selected_file &&
          typeof ingest.selected_file["name"] === "string"
            ? (ingest.selected_file["name"] as string)
            : undefined;
        toast.success(`Added ${modName}`, {
          id: controller.toastId,
          description: fileName ?? controller.getLastDescription(),
        });
        if (ingest.activation_warning) {
          toast.warning(ingest.activation_warning);
        }
        await finalizeSuccess();
      } catch (err) {
        controller.stop();
        handleNxmError(
          err,
          "Failed to ingest Nexus download",
          controller.toastId
        );
        return;
      }
    } catch (err) {
      handleNxmError(err, "Failed to ingest Nexus download");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setModLink("");
      setLocalPath("");
      setUploadInfo(null);
      setUploading(false);
      setBusy(false);
    }
  }, [open]);

  const handleBrowse = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadModFile(file);
      setLocalPath(uploaded.path);
      setUploadInfo(uploaded);
      setModLink("");
      toast.success(
        `Uploaded ${file.name} (${formatBytes(uploaded.size)}) to downloads`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload mod file";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleAdd = async () => {
    if (uploading) return;
    const trimmedLink = modLink.trim();
    const path = localPath || trimmedLink;
    if (!path) return;
    const isUrl = /^https?:\/\//i.test(trimmedLink);

    if (!localPath && trimmedLink) {
      if (/^nxm:\/\//i.test(trimmedLink)) {
        await handleDirectNxm(trimmedLink);
        return;
      }
      if (isUrl) {
        const nexusDetails = parseNexusModLink(trimmedLink);
        if (nexusDetails) {
          await handleNexusLink(nexusDetails);
          return;
        }
      }
    }

    setBusy(true);
    try {
      const res = await addMod({
        localPath: path,
        ...(isUrl ? { sourceUrl: trimmedLink } : {}),
      });
      if (res.ok) {
        toast.success(
          `Added: ${res.name} ${
            res.ingested_paks
              ? `(${res.ingested_paks} pak${
                  res.ingested_paks !== 1 ? "s" : ""
                })`
              : ""
          }`
        );
        if (res.ingest_warning) {
          toast.warning(res.ingest_warning);
        }
        if (res.metadata_warning) {
          toast.warning(res.metadata_warning);
        } else if (res.synced_mod_id) {
          toast.success(`Synced Nexus metadata for mod #${res.synced_mod_id}`);
        }
        setModLink("");
        setLocalPath("");
        setUploadInfo(null);
        await finalizeSuccess();
      } else {
        toast.error("Add mod failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to add mod");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-lg shadow-xl"
        style={{ width: "50%" }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add a Mod</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Paste Link */}
          <div className="space-y-2">
            <label
              htmlFor="mod-link"
              className="block text-sm font-medium text-foreground"
            >
              Paste Mod Link or Local Path
            </label>
            <input
              id="mod-link"
              type="text"
              value={modLink}
              onChange={(e) => {
                const value = e.target.value;
                setModLink(value);
                if (uploadInfo) {
                  setUploadInfo(null);
                }
                setLocalPath("");
              }}
              placeholder="https://... or C:\\path\\to\\mod.zip"
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          {/* Drag and Drop */}
          <div
            className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg flex flex-col items-center justify-center py-12 px-6 text-muted-foreground cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200"
            data-uploading={uploading ? "true" : "false"}
          >
            <div className="text-2xl mb-3">📁</div>
            <span className="text-base font-medium mb-1">
              Drag & Drop Mod File Here
            </span>
            <span className="text-xs">
              {uploading
                ? "Uploading..."
                : uploadInfo
                ? `Saved as ${uploadInfo.relative_path}`
                : "or click to browse"}
            </span>
            <input
              type="file"
              className="absolute opacity-0 w-full h-full cursor-pointer"
              style={{ left: 0, top: 0 }}
              onChange={(e) => handleBrowse(e.target.files?.[0])}
            />
          </div>
          {localPath && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-foreground">
                  Selected source
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-xs"
                  onClick={() => {
                    setLocalPath("");
                    setUploadInfo(null);
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="mt-1 break-all">{localPath}</div>
              {uploadInfo && (
                <div className="mt-1">
                  Stored under downloads as {uploadInfo.relative_path} (
                  {formatBytes(uploadInfo.size)})
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <DialogClose asChild>
            <Button variant="ghost" className="px-4 py-2">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="default"
            disabled={busy || uploading || (!modLink.trim() && !localPath)}
            onClick={handleAdd}
            className="px-4 py-2"
          >
            {busy ? "Adding..." : "Add Mod"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
