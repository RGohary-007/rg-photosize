import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

export const startDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { startConnect } = await import("@/server/googleDrive.server");
    const request = getRequest();
    if (!request) throw new Error("Connecting must start from an app request.");
    const returnUrl = new URL("/oauth/google-drive/return", request.url).toString();
    return startConnect(context.userId, returnUrl);
  });

export const completeDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (!input?.code || typeof input.code !== "string" || input.code.length > 4096) {
      throw new Error("Missing OAuth code");
    }
    return { code: input.code };
  })
  .handler(async ({ data, context }) => {
    const { completeConnect } = await import("@/server/googleDrive.server");
    await completeConnect(context.userId, data.code);
    return { ok: true };
  });

export const driveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isConnected } = await import("@/server/googleDrive.server");
    return { connected: await isConnected(context.userId) };
  });

export const disconnectDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnect } = await import("@/server/googleDrive.server");
    await disconnect(context.userId);
    return { ok: true };
  });

export const listDrivePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string } | undefined) => ({
    search: typeof input?.search === "string" ? input.search.slice(0, 100) : "",
  }))
  .handler(async ({ data, context }) => {
    const { listPhotos } = await import("@/server/googleDrive.server");
    return { files: await listPhotos(context.userId, data.search || undefined) };
  });

export const fetchDrivePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) => {
    if (!input?.fileId || typeof input.fileId !== "string" || input.fileId.length > 256) {
      throw new Error("Invalid file id");
    }
    return { fileId: input.fileId };
  })
  .handler(async ({ data, context }) => {
    const { downloadPhoto } = await import("@/server/googleDrive.server");
    return downloadPhoto(context.userId, data.fileId);
  });
