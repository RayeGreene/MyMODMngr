import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import {
  getNxmProtocolStatus,
  registerNxmProtocol,
  unregisterNxmProtocol,
  getLastNxmUrl,
  type NxmProtocolStatus,
  type LastNxmUrl,
} from "../lib/api";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  TestTube2,
} from "lucide-react";
import { toast } from "sonner";

export function NxmProtocolSettings() {
  const [status, setStatus] = useState<NxmProtocolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [executablePath, setExecutablePath] = useState<string | null>(null);
  const [lastNxmUrl, setLastNxmUrl] = useState<LastNxmUrl | null>(null);
  const [showLastUrl, setShowLastUrl] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const [protocolStatus, exePath] = await Promise.all([
        getNxmProtocolStatus(),
        invoke<string>("get_executable_path").catch(() => null),
      ]);
      setStatus(protocolStatus);
      setExecutablePath(exePath);
    } catch (error) {
      console.error("Failed to load NXM protocol status:", error);
      toast.error("Failed to check NXM protocol status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleRegister = async () => {
    if (!executablePath) {
      toast.error("Could not determine application executable path");
      return;
    }

    try {
      setActionLoading(true);
      const result = await registerNxmProtocol(executablePath);

      if (result.ok) {
        toast.success("NXM protocol registered successfully");
        await loadStatus();
      } else {
        toast.error(result.error || "Failed to register NXM protocol");
      }
    } catch (error) {
      console.error("Failed to register NXM protocol:", error);
      toast.error("Failed to register NXM protocol");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnregister = async () => {
    try {
      setActionLoading(true);
      const result = await unregisterNxmProtocol();

      if (result.ok) {
        toast.success("NXM protocol unregistered successfully");
        await loadStatus();
      } else {
        toast.error(result.error || "Failed to unregister NXM protocol");
      }
    } catch (error) {
      console.error("Failed to unregister NXM protocol:", error);
      toast.error("Failed to unregister NXM protocol");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestProtocol = async () => {
    // Sample NXM URL (Marvel Rivals mod #2, file #73) with synthetic query params
    const testUrl =
      "nxm://marvelrivals/mods/2/files/73?key=TEST_KEY_123&expires=9999999999&user_id=TEST_USER";
    setShowLastUrl(false);
    setLastNxmUrl(null);

    try {
      toast.info("Testing NXM protocol...", {
        description: "Sending test URL to verify parameter handling",
      });

      // Open the test URL using the system's protocol handler
      await openUrl(testUrl);

      // Wait a moment for the backend to receive the URL
      setTimeout(async () => {
        try {
          const result = await getLastNxmUrl();
          setLastNxmUrl(result);
          setShowLastUrl(true);

          if (result.last_url && result.last_url.parsed) {
            const parsed = result.last_url.parsed;
            const allParamsPresent =
              parsed.has_key && parsed.has_expires && parsed.has_user_id;

            if (allParamsPresent) {
              toast.success("✅ Test Passed!", {
                description: `All query parameters received correctly:\n• key=${parsed.query_params.key}\n• expires=${parsed.query_params.expires}\n• user_id=${parsed.query_params.user_id}`,
                duration: 8000,
              });
            } else {
              const missing = [];
              if (!parsed.has_key) missing.push("key");
              if (!parsed.has_expires) missing.push("expires");
              if (!parsed.has_user_id) missing.push("user_id");

              toast.error("❌ Test Failed - Parameters Missing!", {
                description: `The following parameters were NOT received: ${missing.join(
                  ", "
                )}. This indicates the NXM protocol registration may be incorrect.`,
                duration: 10000,
              });
            }
          } else if (result.last_url && result.last_url.parse_error) {
            toast.error("Parse Error", {
              description: result.last_url.parse_error,
              duration: 8000,
            });
          } else {
            toast.warning("No response yet", {
              description:
                "The backend hasn't received the test URL yet. Check if the app is registered correctly.",
              duration: 6000,
            });
          }
        } catch (error) {
          console.error("Failed to fetch last NXM URL:", error);
          toast.error("Could not verify test results", {
            description:
              "Failed to retrieve the last received URL from backend",
          });
        }
      }, 1500); // Wait 1.5 seconds for the backend to process
    } catch (error) {
      console.error("Failed to test NXM protocol:", error);
      toast.error("Failed to test NXM protocol", {
        description: String(error),
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>NXM Protocol Registration</CardTitle>
          <CardDescription>
            Manage Nexus Mod Manager (nxm://) protocol association
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>NXM Protocol Registration</CardTitle>
          <CardDescription>
            Manage Nexus Mod Manager (nxm://) protocol association
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to check NXM protocol status
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isRegistered = status.registered;
  const isRegisteredToThisApp =
    isRegistered &&
    executablePath &&
    status.registered_path &&
    status.registered_path.toLowerCase() === executablePath.toLowerCase();

  return (
    <Card style={{ padding: "14px 0" }}>
      <CardHeader>
        <CardTitle>NXM Protocol Registration</CardTitle>
        <CardDescription>
          Register the application to handle nxm:// links from NexusMods.com
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Display */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isRegistered ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium">
              {isRegistered
                ? "NXM protocol is registered"
                : "NXM protocol is not registered"}
            </span>
          </div>

          {isRegistered && status.registered_path && (
            <div className="ml-7 text-sm text-muted-foreground">
              <div className="font-mono text-xs break-all">
                {status.registered_path}
              </div>
              {!isRegisteredToThisApp && (
                <Alert variant="default" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The NXM protocol is registered to a different application.
                    You can re-register it to use this application instead.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {executablePath && (
            <div className="ml-7 text-sm text-muted-foreground">
              <div className="font-medium mb-1">This application:</div>
              <div className="font-mono text-xs break-all">
                {executablePath}
              </div>
            </div>
          )}
        </div>

        {/* Information
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Registering the NXM protocol allows you to download mods directly
            from NexusMods.com by clicking "Mod Manager Download" buttons. The
            links will automatically open in this application.
            {isRegistered && (
              <>
                <br />
                <br />
                <strong>Test Protocol:</strong> Click the "Test Protocol" button
                to open the sample Marvel Rivals mod (file #73) as an{" "}
                <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                  nxm://
                </code>
                link. The results panel will show whether the key, expires, and
                user_id parameters were preserved end-to-end (
                <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                  &amp;key=
                </code>
                ,
                <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                  &amp;expires=
                </code>
                , and
                <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                  &amp;user_id=
                </code>
                ).
              </>
            )}
          </AlertDescription>
        </Alert> */}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {!isRegistered || !isRegisteredToThisApp ? (
            <Button
              onClick={handleRegister}
              disabled={actionLoading || !executablePath}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isRegistered ? "Re-register" : "Register"} NXM Protocol
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleUnregister}
              disabled={actionLoading}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Unregister NXM Protocol
            </Button>
          )}

          {/* Test Protocol Button */}
          {isRegistered && (
            <Button
              variant="outline"
              onClick={handleTestProtocol}
              disabled={actionLoading}
            >
              <TestTube2 className="mr-2 h-4 w-4" />
              Test Protocol
            </Button>
          )}
        </div>

        {/* Test Results Display */}
        {showLastUrl && lastNxmUrl?.last_url && (
          <Alert
            variant={
              lastNxmUrl.last_url.parsed?.has_key &&
              lastNxmUrl.last_url.parsed?.has_expires &&
              lastNxmUrl.last_url.parsed?.has_user_id
                ? "default"
                : "destructive"
            }
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {lastNxmUrl.last_url.parsed ? (
                  <>
                    <div className="font-medium mb-2">Last Test Results:</div>
                    <div className="space-y-1 text-sm font-mono">
                      <div className="flex items-center gap-2">
                        {lastNxmUrl.last_url.parsed.has_key ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>
                          key=
                          {lastNxmUrl.last_url.parsed.query_params.key ||
                            "(missing)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {lastNxmUrl.last_url.parsed.has_expires ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>
                          expires=
                          {lastNxmUrl.last_url.parsed.query_params.expires ||
                            "(missing)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {lastNxmUrl.last_url.parsed.has_user_id ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>
                          user_id=
                          {lastNxmUrl.last_url.parsed.query_params.user_id ||
                            "(missing)"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Received:{" "}
                      {new Date(
                        lastNxmUrl.last_url.received_at
                      ).toLocaleString()}
                    </div>
                  </>
                ) : lastNxmUrl.last_url.parse_error ? (
                  <>
                    <div className="font-medium mb-1">Parse Error:</div>
                    <div className="text-sm">
                      {lastNxmUrl.last_url.parse_error}
                    </div>
                  </>
                ) : (
                  <div className="text-sm">URL received but not parsed yet</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLastUrl(false)}
                className="shrink-0"
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        {status.error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{status.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
