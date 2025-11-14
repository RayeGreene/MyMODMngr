import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  AlertCircle,
  CheckCircle,
  Hammer,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type {
  ApiBootstrapStatus,
  ApiSettings,
  ApiSettingsTaskResponse,
} from "../lib/api";
import { validatePath } from "../lib/api";
import type { SettingsFormValues } from "./SettingsDialog";
import { TaskOutputSummary } from "./TaskOutputSummary";

const EMPTY_VALUES: SettingsFormValues = {
  data_dir: "",
  marvel_rivals_root: "",
  marvel_rivals_local_downloads_root: "",
  nexus_api_key: "",
  aes_key_hex: "",
  allow_direct_api_downloads: false,
  repak_bin: "",
  retoc_cli: "",
  seven_zip_bin: "",
};

type Stage = "collect" | "ready" | "running" | "complete";

interface GetStartedDialogProps {
  open: boolean;
  loadingSettings: boolean;
  savingSettings: boolean;
  settings: ApiSettings | null;
  bootstrapStatus: ApiBootstrapStatus | null;
  job: ApiSettingsTaskResponse | null;
  jobRunning: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SettingsFormValues) => Promise<boolean>;
  onRunBootstrap: () => Promise<boolean>;
  onRefreshSettings: () => void;
  onRefreshStatus: () => void;
}

export function GetStartedDialog({
  open,
  loadingSettings,
  savingSettings,
  settings,
  bootstrapStatus,
  job,
  jobRunning,
  onOpenChange,
  onSubmit,
  onRunBootstrap,
  onRefreshSettings,
  onRefreshStatus,
}: GetStartedDialogProps) {
  const [formValues, setFormValues] =
    useState<SettingsFormValues>(EMPTY_VALUES);
  const [stage, setStage] = useState<Stage>("collect");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pathCheckResults, setPathCheckResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [, setValidatingFields] = useState<Set<string>>(new Set());

  // Debounce timer refs for each field
  const debounceTimers = useState<Record<string, NodeJS.Timeout>>(
    () => ({})
  )[0];

  useEffect(() => {
    if (!open) {
      return; // Don't reset when closing
    }
    if (settings) {
      // Always update form values when settings change
      setFormValues({
        data_dir: settings.data_dir ?? "",
        marvel_rivals_root: settings.marvel_rivals_root ?? "",
        marvel_rivals_local_downloads_root:
          settings.marvel_rivals_local_downloads_root ?? "",
        nexus_api_key: settings.nexus_api_key ?? "",
        aes_key_hex: settings.aes_key_hex ?? "",
        allow_direct_api_downloads: settings.allow_direct_api_downloads,
        repak_bin: settings.repak_bin ?? "",
        retoc_cli: settings.retoc_cli ?? "",
        seven_zip_bin: settings.seven_zip_bin ?? "",
      });
    }
  }, [open, settings]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (jobRunning) {
      if (stage !== "running") {
        console.log("[GetStarted] Transitioning to running stage");
        setStage("running");
      }
      return;
    }
    if (stage === "running" && !jobRunning) {
      console.log(
        "[GetStarted] Job completed, checking status:",
        job?.status,
        "ok:",
        job?.ok
      );
      const succeeded = job?.status === "succeeded" && job?.ok === true;
      const failed =
        job?.status === "failed" ||
        (job?.status === "succeeded" && job?.ok === false);
      if (succeeded) {
        console.log("[GetStarted] Success! Transitioning to complete stage");
        setStage("complete");
        setErrorMessage(null);
        return;
      }
      if (failed) {
        console.log("[GetStarted] Failed! Transitioning back to ready stage");
        setStage("ready");
        setErrorMessage(
          job?.error?.trim() ||
            "Initial database build failed. Review the output below and try again."
        );
        return;
      }
      console.log("[GetStarted] Job in intermediate state, waiting...");
    }
  }, [open, jobRunning, job, stage]);

  const isSaving = savingSettings || loadingSettings;

  const requiredValidationOk = useMemo(() => {
    const validation = settings?.validation;
    if (!validation) return false;
    const keys: Array<keyof typeof validation> = [
      "data_dir",
      "marvel_rivals_root",
      "marvel_rivals_local_downloads_root",
    ];
    return keys.every((key) => validation[key]?.ok);
  }, [settings]);

  const handleInputChange =
    (field: Exclude<keyof SettingsFormValues, "allow_direct_api_downloads">) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormValues((prev) => ({ ...prev, [field]: value }));

      // Clear previous validation result
      setPathCheckResults((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });

      // Clear existing debounce timer for this field
      if (debounceTimers[field]) {
        clearTimeout(debounceTimers[field]);
      }

      // Only validate path fields
      const pathFields = new Set([
        "data_dir",
        "marvel_rivals_root",
        "marvel_rivals_local_downloads_root",
        "repak_bin",
        "retoc_cli",
      ]);

      if (!pathFields.has(field) || !value.trim()) {
        return;
      }

      // Set new debounce timer (500ms after user stops typing)
      debounceTimers[field] = setTimeout(async () => {
        setValidatingFields((prev) => new Set(prev).add(field));

        try {
          const result = await validatePath(field, value);
          setPathCheckResults((prev) => ({
            ...prev,
            [field]: {
              ok: result.ok,
              message: result.message,
            },
          }));
        } catch (err) {
          setPathCheckResults((prev) => ({
            ...prev,
            [field]: {
              ok: false,
              message: "Error validating path",
            },
          }));
          console.error(`Failed to validate ${field}:`, err);
        } finally {
          setValidatingFields((prev) => {
            const next = new Set(prev);
            next.delete(field);
            return next;
          });
        }
      }, 500);
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setErrorMessage(null);
    const ok = await onSubmit(formValues);
    if (ok) {
      setStage("ready");
      onRefreshSettings();
      onRefreshStatus();
    } else {
      setErrorMessage(
        "Unable to save settings. Resolve the highlighted fields and try again."
      );
    }
  };

  const handleRunBootstrapClick = async () => {
    setErrorMessage(null);

    // CRITICAL: Save settings BEFORE running bootstrap so the rebuild script
    // can read the latest configuration (API key, paths, etc.) from disk
    console.log("[GetStartedDialog] Saving settings before bootstrap...");
    const settingsSaved = await onSubmit(formValues);
    if (!settingsSaved) {
      setErrorMessage(
        "Unable to save settings. Please fix any errors and try again."
      );
      return;
    }
    console.log(
      "[GetStartedDialog] Settings saved successfully, starting bootstrap..."
    );

    // Small delay to ensure settings.json is fully written to disk before subprocess reads it
    await new Promise((resolve) => setTimeout(resolve, 200));

    setStage("running");
    const ok = await onRunBootstrap();
    if (ok) {
      setStage("complete");
      onRefreshStatus();
    } else {
      setStage("ready");
      setErrorMessage(
        "Initial database build failed. Review the output below and try again."
      );
    }
  };

  const handleRefreshValidation = () => {
    onRefreshSettings();
    onRefreshStatus();
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    const canClose = !jobRunning || stage === "complete";
    if (!nextOpen && !canClose) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const bootstrapSummary = bootstrapStatus ? (
    <div className="mt-4 rounded-lg border border-border/40 bg-muted/10 p-4 text-sm">
      <div
        className={`flex items-center gap-2 ${
          bootstrapStatus.needs_bootstrap
            ? "text-amber-500"
            : "text-emerald-500"
        }`}
      >
        <CheckCircle className="h-4 w-4" />
        <span>
          {bootstrapStatus.needs_bootstrap
            ? "Database is empty. The initial build will populate all tables."
            : "Database already contains records. Rerunning will refresh everything."}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div>
          <p className="font-semibold text-foreground">Database file</p>
          <p className="break-all">
            {bootstrapStatus.db_path || "(not detected)"}
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Existing downloads</p>
          <p>{bootstrapStatus.downloads_count}</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Mods loaded</p>
          <p>{bootstrapStatus.mods_count}</p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Schema migrations</p>
          <p>{bootstrapStatus.schema_migrations}</p>
        </div>
      </div>
    </div>
  ) : null;

  const disableRunBootstrap = jobRunning;

  const jobOutput = job?.output?.trim() ?? "";

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        style={{
          maxWidth: "48rem",
          width: "100%",
          maxHeight: "calc(100vh - 48px)",
          minHeight: "320px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: "0",
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "2rem",
            boxSizing: "border-box",
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              Welcome to RivalNxt
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Configure the core folders and tools, then build the local
              database with a guided setup.
            </DialogDescription>
          </DialogHeader>

          {stage === "collect" ? (
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <div
                style={{
                  borderRadius: "0.5rem",
                  background: "rgba(243,244,246,0.05)",
                  padding: "1rem",
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  marginTop: "1rem",
                }}
              >
                Provide absolute paths so the backend can locate your game
                files, downloads, and optional tooling. You can adjust these
                later from the Settings panel.
              </div>
              <div
                style={{
                  maxHeight: "28rem",
                  overflowY: "auto",
                  paddingRight: "1rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="data_dir">Data directory</Label>
                    <Input
                      id="data_dir"
                      placeholder="C:\\Users\\You\\AppData\\Local\\RivalsManager"
                      value={formValues.data_dir}
                      onChange={handleInputChange("data_dir")}
                      className="flex-1"
                    />
                    {pathCheckResults.data_dir && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: pathCheckResults.data_dir.ok
                            ? "#059669"
                            : "#dc2626",
                          marginTop: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        {pathCheckResults.data_dir.ok ? (
                          <CheckCircle
                            style={{ width: "0.875rem", height: "0.875rem" }}
                          />
                        ) : (
                          <AlertCircle
                            style={{ width: "0.875rem", height: "0.875rem" }}
                          />
                        )}
                        {pathCheckResults.data_dir.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="marvel_rivals_root">
                      Marvel Rivals root
                    </Label>
                    <Input
                      id="marvel_rivals_root"
                      placeholder="...\SteamLibrary\steamapps\common\MarvelRivals"
                      value={formValues.marvel_rivals_root}
                      onChange={handleInputChange("marvel_rivals_root")}
                      className="flex-1"
                    />
                    {pathCheckResults.marvel_rivals_root && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: pathCheckResults.marvel_rivals_root.ok
                            ? "#059669"
                            : "#dc2626",
                          marginTop: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        {pathCheckResults.marvel_rivals_root.ok ? (
                          <CheckCircle
                            style={{ width: "0.875rem", height: "0.875rem" }}
                          />
                        ) : (
                          <AlertCircle
                            style={{ width: "0.875rem", height: "0.875rem" }}
                          />
                        )}
                        {pathCheckResults.marvel_rivals_root.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="marvel_rivals_local_downloads_root">
                      Local downloads folder
                    </Label>
                    <Input
                      id="marvel_rivals_local_downloads_root"
                      placeholder="...\Marvel_Rivals_Mods\downloads"
                      value={formValues.marvel_rivals_local_downloads_root}
                      onChange={handleInputChange(
                        "marvel_rivals_local_downloads_root"
                      )}
                      className="flex-1"
                    />
                    {pathCheckResults.marvel_rivals_local_downloads_root && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: pathCheckResults
                            .marvel_rivals_local_downloads_root.ok
                            ? "#059669"
                            : "#dc2626",
                          marginTop: "0.25rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        {pathCheckResults.marvel_rivals_local_downloads_root
                          .ok ? (
                          <CheckCircle
                            style={{ width: "0.875rem", height: "0.875rem" }}
                          />
                        ) : (
                          <AlertCircle
                            style={{ width: "0.875rem", height: "0.875rem" }}
                          />
                        )}
                        {
                          pathCheckResults.marvel_rivals_local_downloads_root
                            .message
                        }
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="repak_bin">repak executable</Label>
                      <Input
                        id="repak_bin"
                        placeholder="...\repak.exe"
                        value={formValues.repak_bin}
                        onChange={handleInputChange("repak_bin")}
                        className="flex-1"
                      />
                      {pathCheckResults.repak_bin && (
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: pathCheckResults.repak_bin.ok
                              ? "#059669"
                              : "#dc2626",
                            marginTop: "0.25rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          {pathCheckResults.repak_bin.ok ? (
                            <CheckCircle
                              style={{ width: "0.875rem", height: "0.875rem" }}
                            />
                          ) : (
                            <AlertCircle
                              style={{ width: "0.875rem", height: "0.875rem" }}
                            />
                          )}
                          {pathCheckResults.repak_bin.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="retoc_cli">retoc CLI</Label>
                      <Input
                        id="retoc_cli"
                        placeholder="...\retoc.exe"
                        value={formValues.retoc_cli}
                        onChange={handleInputChange("retoc_cli")}
                        className="flex-1"
                      />
                      {pathCheckResults.retoc_cli && (
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: pathCheckResults.retoc_cli.ok
                              ? "#059669"
                              : "#dc2626",
                            marginTop: "0.25rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          {pathCheckResults.retoc_cli.ok ? (
                            <CheckCircle
                              style={{ width: "0.875rem", height: "0.875rem" }}
                            />
                          ) : (
                            <AlertCircle
                              style={{ width: "0.875rem", height: "0.875rem" }}
                            />
                          )}
                          {pathCheckResults.retoc_cli.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nexus_api_key">Nexus API key</Label>
                      <Input
                        id="nexus_api_key"
                        type="password"
                        placeholder="•••••••••••••••"
                        value={formValues.nexus_api_key}
                        onChange={handleInputChange("nexus_api_key")}
                      />
                      {settings?.validation?.nexus_api_key ? (
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: settings.validation.nexus_api_key.ok
                              ? "#059669"
                              : settings.validation.nexus_api_key.reason ===
                                "not_configured"
                              ? "#6b7280"
                              : "#dc2626",
                            marginTop: "0.25rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          {settings.validation.nexus_api_key.ok ? (
                            <CheckCircle
                              style={{ width: "0.875rem", height: "0.875rem" }}
                            />
                          ) : (
                            <AlertCircle
                              style={{ width: "0.875rem", height: "0.875rem" }}
                            />
                          )}
                          {settings.validation.nexus_api_key.message?.trim() ||
                            ""}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="aes_key_hex">AES key</Label>
                      <Input
                        id="aes_key_hex"
                        type="password"
                        placeholder="hex-encoded key"
                        value={formValues.aes_key_hex}
                        onChange={handleInputChange("aes_key_hex")}
                      />
                    </div>
                  </div>
                </div>
                {/* scrollable content ends here */}
              </div>

              {errorMessage ? (
                <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    "Save & Continue"
                  )}
                </Button>
              </div>
            </form>
          ) : null}

          {stage === "ready" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/5 p-4">
                <Hammer className="mt-1 h-5 w-5 text-primary" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-foreground">
                    Settings saved. Run the initial database build when you are
                    ready.
                  </p>
                  <p className="text-muted-foreground">
                    This will scan your downloads, ingest pak metadata, sync
                    Nexus details, rebuild tags, and refresh conflict tables.
                  </p>
                </div>
              </div>

              {bootstrapSummary}

              {!requiredValidationOk ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-500">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>
                    One or more required directories still needs attention.
                    Update the paths before running the build.
                  </span>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {jobOutput ? (
                <div className="space-y-2">
                  <Label>Last run output</Label>
                  <TaskOutputSummary
                    task={job?.task ?? "bootstrap_rebuild"}
                    output={jobOutput}
                    fallbackMinHeight="h-40"
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshValidation}
                    disabled={jobRunning}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Refresh status
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStage("collect")}
                    disabled={jobRunning}
                  >
                    Edit paths
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={handleRunBootstrapClick}
                  disabled={disableRunBootstrap || !requiredValidationOk}
                >
                  {jobRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Run initial build"
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {stage === "running" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/5 p-4 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  Initial build is running. This may take a few minutes.
                </span>
              </div>
              <div className="space-y-2">
                <Label>Task output</Label>
                <TaskOutputSummary
                  task={job?.task ?? "bootstrap_rebuild"}
                  output={jobOutput}
                  isRunning={jobRunning}
                  fallbackMinHeight="h-64"
                />
              </div>
            </div>
          ) : null}

          {stage === "complete" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-500" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">Finished</p>
                  <p className="text-muted-foreground">
                    <code className="rounded bg-emerald-500/20 px-1 py-0.5 text-xs text-emerald-100">
                      [rebuild_sqlite] Rebuild completed successfully.
                    </code>{" "}
                    All tables have been refreshed.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Task output</Label>
                <TaskOutputSummary
                  task={job?.task ?? "bootstrap_rebuild"}
                  output={jobOutput}
                  fallbackMinHeight="h-64"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                }}
              >
                <Button variant="outline" onClick={() => setStage("ready")}>
                  View status
                </Button>
                <Button onClick={() => onOpenChange(false)}>
                  Finished – View Mods
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
