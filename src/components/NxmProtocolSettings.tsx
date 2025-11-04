import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  getNxmProtocolStatus,
  registerNxmProtocol,
  unregisterNxmProtocol,
  type NxmProtocolStatus,
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
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function NxmProtocolSettings() {
  const [status, setStatus] = useState<NxmProtocolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [executablePath, setExecutablePath] = useState<string | null>(null);

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
    <Card>
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

        {/* Information */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Registering the NXM protocol allows you to download mods directly
            from NexusMods.com by clicking "Mod Manager Download" buttons. The
            links will automatically open in this application.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex gap-2">
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
        </div>

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
