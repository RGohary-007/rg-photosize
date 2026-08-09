import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { completeDriveConnect } from "@/lib/drive.functions";

export const Route = createFileRoute("/oauth/google-drive/return")({
  head: () => ({
    meta: [
      { title: "Finishing Google Drive connection — PhotoSize" },
      {
        name: "description",
        content: "Completing the secure Google Drive connection so PhotoSize can import your photos.",
      },
      { property: "og:title", content: "Finishing Google Drive connection" },
      {
        property: "og:description",
        content: "Completing the secure Google Drive connection for PhotoSize.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OAuthReturn,
  errorComponent: ({ error }) => (
    <main className="p-8 text-sm">Could not finish the connection: {error.message}</main>
  ),
});

const CONNECTOR_ID = "google_drive";

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing the connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
    ) => {
      window.opener?.postMessage({ type, connectorId: CONNECTOR_ID }, window.location.origin);
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "The connection was not completed.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Google did not return a connection code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    void completeDriveConnect({ data: { code } })
      .then(() => notify("appUserConnectorOAuthComplete"))
      .catch(() => {
        setMessage("Could not finish the connection.");
        notify("appUserConnectorOAuthFailed");
      });
  }, []);

  return <main className="p-8 text-sm text-muted-foreground">{message}</main>;
}
