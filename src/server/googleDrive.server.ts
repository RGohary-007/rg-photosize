// Google Drive photo import for the signed-in app user.
// Server-only helpers used by the server functions in drive.functions.ts.
import {
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import {
  deleteConnectionForUser,
  getConnectionKeyForUser,
  saveConnectionKeyForUser,
} from "@/server/appUserConnections.server";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const CONNECTOR_ID = "google_drive";

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.readonly",
];

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  thumbnailLink?: string;
};

function clientApiKey(): string {
  const key = process.env["GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY"];
  if (!key) throw new Error("Google Drive is not configured for this app yet.");
  return key;
}

export async function startConnect(userId: string, returnUrl: string) {
  const existing = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  const { authorizationUrl } = await authorizeAppUserOAuth({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectorId: CONNECTOR_ID,
    appUserId: userId,
    clientAPIKey: clientApiKey(),
    returnUrl,
    connectionAPIKey: existing ?? undefined,
    credentialsConfiguration: { scopes: SCOPES },
  });
  return { authorizationUrl };
}

export async function completeConnect(userId: string, code: string) {
  const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
  if (connectorId !== CONNECTOR_ID) {
    throw new Error("OAuth completion returned the wrong connector");
  }
  await saveConnectionKeyForUser(userId, connectorId, connectionAPIKey);
}

async function requireKey(userId: string) {
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) throw new Error("Google Drive is not connected for this account.");
  return key;
}

export async function isConnected(userId: string) {
  return (await getConnectionKeyForUser(userId, CONNECTOR_ID)) !== null;
}

export async function disconnect(userId: string) {
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (key) {
    await disconnectAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
    });
  }
  await deleteConnectionForUser(userId, CONNECTOR_ID);
}

async function gateway(userId: string, path: string, init?: RequestInit) {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: await requireKey(userId),
    connectorId: CONNECTOR_ID,
    path,
    init,
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Drive request failed [${res.status}]: ${body}`);
    throw new Error(`Google Drive request failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res;
}

/** List the user's own Drive images, newest first. */
export async function listPhotos(userId: string, search?: string) {
  const clauses = ["mimeType contains 'image/'", "trashed = false"];
  if (search) clauses.push(`name contains '${search.replace(/['\\]/g, "")}'`);
  const params = new URLSearchParams({
    q: clauses.join(" and "),
    pageSize: "50",
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,size,modifiedTime,thumbnailLink)",
  });
  const res = await gateway(userId, `/drive/v3/files?${params.toString()}`);
  const body = (await res.json()) as { files?: Record<string, string>[] };
  return (body.files ?? []).map<DriveFile>((f) => ({
    id: String(f["id"]),
    name: String(f["name"]),
    mimeType: String(f["mimeType"]),
    size: Number(f["size"] ?? 0),
    modifiedTime: String(f["modifiedTime"] ?? ""),
    ...(f["thumbnailLink"] ? { thumbnailLink: String(f["thumbnailLink"]) } : {}),
  }));
}

/** Download one Drive file and return it base64-encoded for the browser. */
export async function downloadPhoto(userId: string, fileId: string) {
  const metaRes = await gateway(
    userId,
    `/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`,
  );
  const meta = (await metaRes.json()) as { name?: string; mimeType?: string };
  const res = await gateway(userId, `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    name: meta.name ?? "photo.jpg",
    mimeType: meta.mimeType ?? "image/jpeg",
    base64: buffer.toString("base64"),
  };
}
