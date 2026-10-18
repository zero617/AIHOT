// One recovery boundary for obsolete public documents, including route metadata in <Meta>.
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { createRenderErrorHandler } from "./lib/render-recovery";

// Capture once before hydration; this belongs to the document, not later navigation responses.
const documentRelease = document.querySelector('meta[name="aihot-release"]')?.getAttribute("content") ?? null;
const onError = createRenderErrorHandler(documentRelease);

// PWA: register the service worker after load so it never competes with hydration. The worker is
// served from /sw.js with Service-Worker-Allowed, so its scope is the whole site.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("[pwa] service worker registration failed", error);
    });
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
    { onCaughtError: onError },
  );
});
