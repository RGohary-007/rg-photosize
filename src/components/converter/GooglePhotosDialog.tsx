import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader as Loader2,
  CircleAlert as AlertCircle,
  ExternalLink,
  ShieldAlert,
  Check,
  Images,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  authorizeGooglePhotos,
  clearStoredToken,
  readStoredToken,
} from "@/lib/googleIdentity";
import {
  createPickerSession,
  deletePickerSession,
  downloadPickedPhoto,
  getGooglePhotosConfig,
  getPickerSession,
  listPickedPhotos,
  type PickedPhoto,
} from "@/lib/googlePhotos.functions";

type Phase =
  | "checking"
  | "setup-needed"
  | "ready"
  | "authorizing"
  | "cancelled"
  | "denied"
  | "creating-session"
  | "waiting"
  | "loading-items"
  | "downloading"
  | "empty"
  | "failed";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (files: File[]) => void | Promise<void>;
};

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function GooglePhotosDialog({ open, onOpenChange, onImport }: Props) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState<string>("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [pickerUri, setPickerUri] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const cancelled = useRef(false);
  const sessionRef = useRef<{ id: string; token: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelled.current = false;
    setPhase("checking");
    setMessage("");
    setPickerUri(null);
    setProgress({ done: 0, total: 0 });

    void getGooglePhotosConfig()
      .then((config) => {
        if (cancelled.current) return;
        setClientId(config.clientId);
        setPhase(config.configured ? "ready" : "setup-needed");
      })
      .catch(() => {
        if (cancelled.current) return;
        setPhase("failed");
        setMessage("Google Photos is not available right now. Please try again.");
      });

    return () => {
      cancelled.current = true;
    };
  }, [open]);

  const cleanupSession = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      await deletePickerSession({ data: { accessToken: session.token, sessionId: session.id } });
    }
  }, []);

  const importPhotos = useCallback(
    async (token: string, sessionId: string) => {
      setPhase("loading-items");
      const { photos } = await listPickedPhotos({ data: { accessToken: token, sessionId } });

      if (photos.length === 0) {
        setPhase("empty");
        return;
      }

      setPhase("downloading");
      setProgress({ done: 0, total: photos.length });

      const files: File[] = [];
      for (const [index, photo] of photos.entries()) {
        if (cancelled.current) return;
        const bytes = await downloadPickedPhoto({
          data: { accessToken: token, baseUrl: photo.baseUrl },
        });
        const blob = base64ToBlob(bytes.base64, bytes.contentType || photo.mimeType);
        files.push(
          new File([blob], safeName(photo, index), {
            type: bytes.contentType || photo.mimeType,
            lastModified: photo.createTime ? Date.parse(photo.createTime) : Date.now(),
          }),
        );
        setProgress({ done: index + 1, total: photos.length });
      }

      await onImport(files);
      await cleanupSession();
      onOpenChange(false);
    },
    [cleanupSession, onImport, onOpenChange],
  );

  const pollForSelection = useCallback(
    async (token: string, sessionId: string, intervalMs: number) => {
      const deadline = Date.now() + 10 * 60 * 1000;
      let wait = intervalMs;

      while (Date.now() < deadline) {
        if (cancelled.current) return;
        await new Promise((resolve) => setTimeout(resolve, wait));
        if (cancelled.current) return;
        const status = await getPickerSession({ data: { accessToken: token, sessionId } });
        if (status.mediaItemsSet) {
          await importPhotos(token, sessionId);
          return;
        }
        wait = status.pollIntervalMs || intervalMs;
      }

      setPhase("failed");
      setMessage("No photos were picked in time. Start again when you're ready.");
    },
    [importPhotos],
  );

  const start = useCallback(async () => {
    if (!clientId) return;
    setMessage("");

    let token = readStoredToken();
    if (!token) {
      setPhase("authorizing");
      const outcome = await authorizeGooglePhotos(clientId);
      if (cancelled.current) return;
      if (outcome.kind === "cancelled") {
        setPhase("cancelled");
        return;
      }
      if (outcome.kind === "denied") {
        setPhase("denied");
        setMessage(outcome.message);
        return;
      }
      if (outcome.kind === "error") {
        setPhase("failed");
        setMessage(outcome.message);
        return;
      }
      token = outcome.token;
    }

    try {
      setPhase("creating-session");
      const session = await createPickerSession({ data: { accessToken: token } });
      if (cancelled.current) return;
      sessionRef.current = { id: session.id, token };
      setPickerUri(session.pickerUri);
      setPhase("waiting");
      window.open(session.pickerUri, "_blank", "noopener,noreferrer");
      await pollForSelection(token, session.id, session.pollIntervalMs);
    } catch (error) {
      if (cancelled.current) return;
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        clearStoredToken();
        setPhase("denied");
        setMessage("Your Google Photos permission expired. Connect again to continue.");
        return;
      }
      if (status === 403) {
        setPhase("denied");
        setMessage(
          "Google refused access to your photo library. Make sure you allow the photo picker permission, then try again.",
        );
        return;
      }
      setPhase("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while talking to Google Photos.",
      );
    }
  }, [clientId, pollForSelection]);

  const retry = useCallback(() => {
    void cleanupSession();
    clearStoredToken();
    void start();
  }, [cleanupSession, start]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          cancelled.current = true;
          void cleanupSession();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Google Photos</DialogTitle>
          <DialogDescription>
            Pick photos from your own Google Photos library and bring them into the converter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm" data-testid="google-photos-state" data-phase={phase}>
          {phase === "checking" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Getting things ready…
            </p>
          )}

          {phase === "setup-needed" && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs">
              <p className="font-semibold">Google Photos isn't set up yet</p>
              <p className="mt-1 text-muted-foreground">
                Your Google photo library connection still needs to be finished before photos can be
                imported. Everything else in the converter works as usual.
              </p>
            </div>
          )}

          {phase === "ready" && (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                You'll be asked to allow PhotoSize to see only the photos you choose. Nothing else in
                your library is read.
              </p>
            </div>
          )}

          {(phase === "authorizing" || phase === "creating-session") && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {phase === "authorizing" ? "Waiting for your Google approval…" : "Opening your library…"}
            </p>
          )}

          {phase === "waiting" && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Waiting for you to pick photos in the Google Photos tab…
              </p>
              {pickerUri && (
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => window.open(pickerUri, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="size-4" />
                  Reopen Google Photos
                </Button>
              )}
            </div>
          )}

          {phase === "loading-items" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Reading your selection…
            </p>
          )}

          {phase === "downloading" && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Importing photo {progress.done} of {progress.total}…
              </p>
              <Progress
                value={progress.total ? (progress.done / progress.total) * 100 : 0}
                className="h-2"
              />
            </div>
          )}

          {phase === "empty" && (
            <div className="rounded-2xl border border-border bg-secondary/40 p-3">
              <p className="flex items-center gap-2 font-medium">
                <Images className="size-4" />
                No photos were selected
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open Google Photos again and tick the photos you want to convert.
              </p>
            </div>
          )}

          {phase === "cancelled" && (
            <div className="rounded-2xl border border-border bg-secondary/40 p-3">
              <p className="font-medium">Google sign-in was cancelled</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The Google window closed before access was given. You can try again any time.
              </p>
            </div>
          )}

          {phase === "denied" && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <ShieldAlert className="size-4" />
                Permission needed
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{message}</p>
            </div>
          )}

          {phase === "failed" && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3">
              <p className="flex items-center gap-2 font-medium text-destructive">
                <AlertCircle className="size-4" />
                Import failed
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">{message}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => {
              cancelled.current = true;
              void cleanupSession();
              onOpenChange(false);
            }}
          >
            Close
          </Button>

          {phase === "ready" && (
            <Button className="rounded-2xl" onClick={() => void start()}>
              <Check className="size-4" />
              Connect Google Photos
            </Button>
          )}

          {(phase === "cancelled" || phase === "denied" || phase === "failed" || phase === "empty") && (
            <Button className="rounded-2xl" onClick={retry} data-testid="google-photos-retry">
              Try again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function safeName(photo: PickedPhoto, index: number): string {
  const name = (photo.filename || `google-photo-${index + 1}.jpg`).replace(/[/\\]/g, "-");
  return name.includes(".") ? name : `${name}.jpg`;
}
