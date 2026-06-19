"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

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
 * "Instalar app" button. Hidden when the app is already installed.
 *
 * Android/desktop (Chromium): captures `beforeinstallprompt` and triggers the
 * native install prompt on click.
 * iOS Safari: no such event — shows the manual "Compartir → Agregar a inicio"
 * instruction instead.
 */
export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setIos(isIos());

    const onBeforeInstall = (e: Event) => {
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
  }, []);

  if (installed) return null;

  // iOS: show a button that reveals the manual install instruction.
  if (ios && !deferredPrompt) {
    return (
      <div className="flex flex-col items-center gap-2 sm:items-end">
        <button
          type="button"
          onClick={() => setShowIosHint((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700"
        >
          <Download className="h-4 w-4" />
          Instalar app
        </button>
        {showIosHint && (
          <p className="flex max-w-xs items-center gap-1 text-[11px] text-muted-foreground">
            Tocá <Share className="inline h-3.5 w-3.5" /> y luego &laquo;Agregar a inicio&raquo;.
          </p>
        )}
      </div>
    );
  }

  // Android / desktop: only render once installable.
  if (!deferredPrompt) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700"
    >
      <Download className="h-4 w-4" />
      Instalar app
    </button>
  );
}
