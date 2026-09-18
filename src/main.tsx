import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App.tsx";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
const nextPublicClerk = import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
const mode = import.meta.env.MODE;
const prod = import.meta.env.PROD;

function debugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) {
  // #region agent log
  fetch("http://127.0.0.1:7631/ingest/a4a1ca46-50a8-4f0d-ab93-74ddc0a73be9", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "9ebf06",
    },
    body: JSON.stringify({
      sessionId: "9ebf06",
      runId: "deploy-pre-fix",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function showFatal(message: string) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="font-family:system-ui;padding:2rem;max-width:40rem"><h1>AlphaTest failed to start</h1><pre style="white-space:pre-wrap;background:#fee2e2;padding:1rem;border-radius:8px">${message}</pre><p style="color:#5a6f78">For Vercel: set <code>VITE_CLERK_PUBLISHABLE_KEY</code> and <code>VITE_CONVEX_URL</code> (Production), then redeploy. Vite embeds these at build time.</p></div>`;
  }
}

debugLog("A", "main.tsx:env-check", "Deployed/local bootstrap env", {
  mode,
  prod,
  host: typeof location !== "undefined" ? location.host : null,
  hasViteConvexUrl: Boolean(convexUrl),
  viteConvexUrlLen: convexUrl?.length ?? 0,
  viteConvexUrlPrefix: convexUrl?.slice(0, 20) ?? null,
  hasViteClerkKey: Boolean(clerkPubKey),
  viteClerkKeyLen: clerkPubKey?.length ?? 0,
  viteClerkKeyPrefix: clerkPubKey?.slice(0, 8) ?? null,
  hasNextPublicClerkKey: Boolean(nextPublicClerk),
  nextPublicClerkKeyLen: nextPublicClerk?.length ?? 0,
});

try {
  if (!convexUrl) {
    debugLog("B", "main.tsx:fatal", "Missing VITE_CONVEX_URL", {
      host: location.host,
    });
    showFatal("Missing VITE_CONVEX_URL");
    throw new Error("Missing VITE_CONVEX_URL");
  }
  if (!clerkPubKey) {
    const hint = nextPublicClerk
      ? "Found NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY but app expects VITE_CLERK_PUBLISHABLE_KEY"
      : "Missing VITE_CLERK_PUBLISHABLE_KEY";
    debugLog("A", "main.tsx:fatal", "Missing VITE_CLERK_PUBLISHABLE_KEY", {
      host: location.host,
      hasNextPublicClerkKey: Boolean(nextPublicClerk),
    });
    showFatal(hint);
    throw new Error(hint);
  }

  const convex = new ConvexReactClient(convexUrl);

  debugLog("C", "main.tsx:before-render", "About to mount React", {
    host: location.host,
    clerkKeyLooksValid: clerkPubKey.startsWith("pk_"),
  });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPubKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </StrictMode>,
  );

  debugLog("D", "main.tsx:after-render", "createRoot.render called", {
    host: location.host,
    ok: true,
  });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  debugLog("E", "main.tsx:catch", "Bootstrap catch", {
    host: typeof location !== "undefined" ? location.host : null,
    errorMessage: message,
  });
  if (!document.getElementById("root")?.textContent) {
    showFatal(message);
  }
}
