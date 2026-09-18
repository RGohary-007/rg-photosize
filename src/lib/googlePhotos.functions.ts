import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PICKER = "https://photospicker.googleapis.com/v1";

async function callPicker(
  accessToken: string,
  path: string,
  init?: { method?: string; body?: unknown },
) {
  const res = await fetch(`${PICKER}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Google Photos Picker request failed [${res.status}]: ${text}`);
    const err = new Error(text || `Google Photos request failed (${res.status})`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

/** The OAuth client id is public by design; it is stored as a project secret. */
export const getGooglePhotosConfig = createServerFn({ method: "GET" }).handler(async () => {
  const clientId = process.env["GOOGLE_PHOTOS_CLIENT_ID"] ?? null;
  return { clientId, configured: Boolean(clientId) };
});

export const createPickerSession = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(10) }).parse(data))
  .handler(async ({ data }) => {
    const session = await callPicker(data.accessToken, "/sessions", { method: "POST", body: {} });
    return {
      id: String(session.id),
      pickerUri: String(session.pickerUri),
      mediaItemsSet: Boolean(session.mediaItemsSet),
      pollIntervalMs: parsePollInterval(session?.pollingConfig?.pollInterval),
    };
  });

function parsePollInterval(value: unknown): number {
  if (typeof value === "string" && value.endsWith("s")) {
    const seconds = Number.parseFloat(value.slice(0, -1));
    if (Number.isFinite(seconds)) return Math.max(1500, Math.round(seconds * 1000));
  }
  return 3000;
}

export const getPickerSession = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ accessToken: z.string().min(10), sessionId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const session = await callPicker(
      data.accessToken,
      `/sessions/${encodeURIComponent(data.sessionId)}`,
    );
    return {
      mediaItemsSet: Boolean(session.mediaItemsSet),
      pollIntervalMs: parsePollInterval(session?.pollingConfig?.pollInterval),
    };
  });

export const deletePickerSession = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ accessToken: z.string().min(10), sessionId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      await callPicker(data.accessToken, `/sessions/${encodeURIComponent(data.sessionId)}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete picker session", error);
    }
    return { ok: true };
  });

export type PickedPhoto = {
  id: string;
  filename: string;
  mimeType: string;
  createTime: string | null;
  baseUrl: string;
  width: number | null;
  height: number | null;
};

export const listPickedPhotos = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ accessToken: z.string().min(10), sessionId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ photos: PickedPhoto[] }> => {
    const photos: PickedPhoto[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ sessionId: data.sessionId, pageSize: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await callPicker(data.accessToken, `/mediaItems?${params.toString()}`);

      for (const item of page.mediaItems ?? []) {
        const file = item.mediaFile ?? {};
        if (item.type && item.type !== "PHOTO") continue;
        if (!file.baseUrl) continue;
        photos.push({
          id: String(item.id),
          filename: String(file.filename ?? `${item.id}.jpg`),
          mimeType: String(file.mimeType ?? "image/jpeg"),
          createTime: item.createTime ? String(item.createTime) : null,
          baseUrl: String(file.baseUrl),
          width: numberOrNull(file?.mediaFileMetadata?.width),
          height: numberOrNull(file?.mediaFileMetadata?.height),
        });
      }
      pageToken = page.nextPageToken ? String(page.nextPageToken) : undefined;
    } while (pageToken);

    return { photos };
  });

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Downloads the original bytes (metadata included) and returns them base64 encoded. */
export const downloadPickedPhoto = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        accessToken: z.string().min(10),
        baseUrl: z.string().url().startsWith("https://"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const res = await fetch(`${data.baseUrl}=d`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Google Photos download failed [${res.status}]: ${body}`);
      throw new Error(`Google Photos download failed [${res.status}]: ${body}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      base64: buffer.toString("base64"),
      contentType: res.headers.get("content-type") ?? "image/jpeg",
    };
  });
