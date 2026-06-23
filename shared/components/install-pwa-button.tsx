"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";

const PWA_CTA_PATHS = new Set<string>(["/", "/shop/catalog"]);

// Not in the TS lib DOM types yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Floating "Instalar app" affordance.
 *
 * Mounted ONCE in the root layout (not in any page) so the
 * `beforeinstallprompt` listener is active on every route, including pages
 * that have no nav chrome. Earlier this component lived in a page that was
 * never reached, so the event was captured by the browser, suppressed via
 * preventDefault(), and never turned into a visible button — triggering the
 * dev-tools warning: "beforeinstallpromptevent.preventDefault() called. The
 * page must call beforeinstallpromptevent.prompt() to show the banner."
 *
 * Behaviour:
 *  - Android / desktop Chromium: native prompt on click.
 *  - iOS Safari: no such event; show a manual "Share → Add to Home" hint.
 *  - Already installed: renders nothing.
 *
 * Also requires a valid /manifest.webmanifest with icons + a registered
 * /sw.js at scope "/". The manifest was missing entirely before this fix;
 * create it in /public/manifest.webmanifest.
 */
export function InstallPwaButton() {
  // Initial state reads standalone synchronously — this is the correct way to
  // sync state with an external (window) check on mount, not a setState in
  // an effect. See https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [dismissed, setDismissed] = useState<boolean>(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("pwa-install-dismissed") === "1"
  );
  const [showIosHint, setShowIosHint] = useState(false);
  const [ios] = useState<boolean>(() => isIos());

  useEffect(() => {
    if (installed) return;

    const onBeforeInstall = (e: Event) => {
      // Suppress Chrome's auto mini-infobar; we render our own button.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed]);

  const pathname = usePathname();
  const ctaVisible = PWA_CTA_PATHS.has(pathname ?? "");

  if (installed || dismissed) return null;

  // Listener must stay mounted on every route (event is single-shot per
  // origin) — only the visible CTA is restricted to landing + catalog.
  if (!ctaVisible) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem("pwa-install-dismissed", "1"); } catch { /* ignore */ }
  };

  // iOS: floating button + inline instruction.
  if (ios && !deferredPrompt) {
    return (
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-xs flex-col items-end gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-brand-600 px-3 py-2 text-xs font-medium text-white shadow-lg ring-1 ring-black/5">
          <button
            type="button"
            onClick={() => setShowIosHint((v) => !v)}
            className="inline-flex items-center gap-1.5"
            aria-label="Cómo instalar la app en iOS"
          >
            <Download className="h-3.5 w-3.5" />
            Instalar app
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar"
            className="ml-1 rounded-full p-0.5 hover:bg-white/20"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        {showIosHint && (
          <p className="pointer-events-auto rounded-lg bg-background/95 px-3 py-2 text-[11px] text-foreground shadow-lg ring-1 ring-border backdrop-blur">
            Tocá <Share className="inline h-3 w-3" /> y elegí &laquo;Agregar a inicio&raquo;.
          </p>
        )}
      </div>
    );
  }

  // Android / desktop: floating CTA once the install prompt is available.
  if (!deferredPrompt) return null;

  const handleInstall = async () => {
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (err) {
      console.warn("[pwa] install prompt error:", err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-brand-600 pl-3 pr-1 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-black/5">
        <button
          type="button"
          onClick={handleInstall}
          className="inline-flex items-center gap-1.5 py-1"
          aria-label="Instalar aplicación"
        >
          <Download className="h-3.5 w-3.5" />
          Instalar app
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso de instalación"
          className="rounded-full p-1 hover:bg-white/20"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
