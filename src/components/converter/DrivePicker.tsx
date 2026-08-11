import { useEffect, useState } from "react";
import { Cloud, Loader2, LogIn, RefreshCw, Search, Unplug } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/convert";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  disconnectDrive,
  driveStatus,
  fetchDrivePhoto,
  listDrivePhotos,
  startDriveConnect,
} from "@/lib/drive.functions";

const CONNECTOR_ID = "google_drive";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  thumbnailLink?: string;
};

function waitForOAuth(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string; connectorId?: string })?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        (event.data as { connectorId?: string })?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") return resolve();
      popup.close();
      reject(new Error("The Google connection was not completed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Google window closed before the connection finished."));
    }, 500);
  });
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (files: File[]) => void;
  onSignIn: () => void;
};

export function DrivePicker({ open, onOpenChange, onImport, onSignIn }: Props) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const isSignedIn = Boolean(data.session);
      setSignedIn(isSignedIn);
      if (!isSignedIn) {
        setConnected(false);
        return;
      }
      try {
        const status = await driveStatus();
        if (!alive) return;
        setConnected(status.connected);
        if (status.connected) void load();
      } catch {
        if (alive) setConnected(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function load(query = "") {
    setLoading(true);
    try {
      const res = await listDrivePhotos({ data: { search: query } });
      setFiles(res.files);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read your Drive photos.");
    } finally {
      setLoading(false);
    }
  }

  async function connect() {
    const popup = window.open("", "google-drive-oauth", "width=600,height=720");
    if (!popup) {
      toast.error("Please allow pop-ups so Google can ask for your permission.");
      return;
    }
    try {
      const { authorizationUrl } = await startDriveConnect();
      const done = waitForOAuth(popup);
      popup.location.href = authorizationUrl;
      await done;
      setConnected(true);
      toast.success("Google Drive connected.");
      void load();
    } catch (error) {
      popup.close();
      toast.error(error instanceof Error ? error.message : "Could not connect Google Drive.");
    }
  }

  async function importSelected() {
    const chosen = files.filter((f) => selected.includes(f.id));
    setImporting(chosen.map((f) => f.id));
    const imported: File[] = [];
    for (const file of chosen) {
      try {
        const res = await fetchDrivePhoto({ data: { fileId: file.id } });
        const binary = atob(res.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        imported.push(new File([bytes], res.name, { type: res.mimeType }));
      } catch {
        toast.error(`Could not download ${file.name}.`);
      }
    }
    setImporting([]);
    setSelected([]);
    if (imported.length) {
      onImport(imported);
      onOpenChange(false);
      toast.success(`Added ${imported.length} photo${imported.length === 1 ? "" : "s"}.`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="size-5 text-primary" />
            Your Google Drive photos
          </DialogTitle>
          <DialogDescription>
            Only your own account is used. Photos are downloaded straight into this converter and
            never stored on our side.
          </DialogDescription>
        </DialogHeader>

        {signedIn === false && (
          <div className="space-y-3 rounded-2xl bg-secondary p-4 text-sm">
            <p className="text-muted-foreground">
              Sign in first so your Google connection stays private to your account.
            </p>
            <Button className="rounded-2xl" onClick={onSignIn}>
              <LogIn className="size-4" />
              Sign in
            </Button>
          </div>
        )}

        {signedIn && connected === false && (
          <div className="space-y-3 rounded-2xl bg-secondary p-4 text-sm">
            <p className="text-muted-foreground">
              Connect your Google account to browse the photos in your own Drive.
            </p>
            <Button className="rounded-2xl" onClick={() => void connect()}>
              Connect Google Drive
            </Button>
          </div>
        )}

        {signedIn && connected && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="rounded-xl pl-9"
                  aria-label="Search photo names"
                  placeholder="Search photo names"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void load(search);
                  }}
                />
              </div>
              <Button
                variant="outline"
                className="rounded-xl"
                aria-label="Refresh photos"
                onClick={() => void load(search)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </Button>
            </div>

            {loading && files.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading your photos…
              </p>
            ) : files.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No photos found in your Drive.
              </p>
            ) : (
              <ul className="space-y-1">
                {files.map((f) => {
                  const active = selected.includes(f.id);
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors",
                          active ? "border-primary bg-accent/60" : "border-border hover:bg-secondary",
                        )}
                        onClick={() =>
                          setSelected((prev) =>
                            prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id],
                          )
                        }
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                          {importing.includes(f.id) ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Cloud className="size-4 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{f.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {f.size ? formatBytes(f.size) : f.mimeType}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="ghost"
                className="rounded-2xl text-muted-foreground"
                onClick={() => {
                  void disconnectDrive()
                    .then(() => {
                      setConnected(false);
                      setFiles([]);
                      toast.success("Google Drive disconnected.");
                    })
                    .catch(() => toast.error("Could not disconnect."));
                }}
              >
                <Unplug className="size-4" />
                Disconnect
              </Button>
              <Button
                className="rounded-2xl"
                disabled={selected.length === 0 || importing.length > 0}
                onClick={() => void importSelected()}
              >
                {importing.length > 0 && <Loader2 className="size-4 animate-spin" />}
                Add {selected.length || ""} photo{selected.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
