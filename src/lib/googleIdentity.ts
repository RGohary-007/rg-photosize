/** Google Identity Services helpers for the Photos Picker authorization flow. */

export const PHOTOS_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

const STORAGE_KEY = "photosize.googlePhotosToken";

type StoredToken = { token: string; expiresAt: number };

export type AuthorizeOutcome =
  | { kind: "token"; token: string; expiresIn: number }
  | { kind: "cancelled" }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: (overrides?: { prompt?: string }) => void };
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed?.token || parsed.expiresAt < Date.now() + 60_000) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

function storeToken(token: string, expiresInSeconds: number) {
  try {
    const value: StoredToken = {
      token,
      expiresAt: Date.now() + Math.max(60, expiresInSeconds) * 1000,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable — the token simply is not remembered */
  }
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadGoogleIdentity(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    const script = existing ?? document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not reach Google. Check your connection and try again."));
    };
    if (!existing) document.head.appendChild(script);
  });

  return scriptPromise;
}

/** Opens Google's consent screen and resolves with a token, or an explicit failure state. */
export async function authorizeGooglePhotos(clientId: string): Promise<AuthorizeOutcome> {
  try {
    await loadGoogleIdentity();
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    return { kind: "error", message: "Google sign-in could not start. Please try again." };
  }

  return new Promise<AuthorizeOutcome>((resolve) => {
    let settled = false;
    const done = (outcome: AuthorizeOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: PHOTOS_SCOPE,
      callback: (response) => {
        if (response.access_token) {
          storeToken(response.access_token, Number(response.expires_in ?? 3600));
          done({ kind: "token", token: response.access_token });
          return;
        }
        const error = response.error ?? "";
        if (error === "access_denied") {
          done({
            kind: "denied",
            message:
              "Google Photos access was not granted. You need to allow the “See your photos” permission to import.",
          });
          return;
        }
        if (error.includes("interaction_required") || error === "popup_closed_by_user") {
          done({ kind: "cancelled" });
          return;
        }
        done({
          kind: "error",
          message: response.error_description || error || "Google did not return access.",
        });
      },
      error_callback: (error) => {
        const type = error?.type ?? "";
        if (type === "popup_closed" || type === "popup_failed_to_open") {
          done({ kind: "cancelled" });
          return;
        }
        done({
          kind: "error",
          message: error?.message || "Google sign-in failed. Please try again.",
        });
      },
    });

    client.requestAccessToken({ prompt: "" });
  });
}

export function revokeGooglePhotos() {
  const token = readStoredToken();
  clearStoredToken();
  if (token) {
    try {
      window.google?.accounts?.oauth2?.revoke(token);
    } catch {
      /* ignore */
    }
  }
}
