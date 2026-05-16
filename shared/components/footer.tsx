import React from "react";
import { logoBase64 } from "./logoBase64";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card py-3">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-4">
          <img 
            src={logoBase64}
            alt="Logo ULEAM" 
            className="h-10 w-auto object-contain invert opacity-80 dark:invert-0 dark:opacity-100 transition-all"
          />
          <div className="hidden h-8 w-px bg-border sm:block" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()}{" "}
            <span className="font-bold text-foreground">ULEAM</span>
            {" "}· Planta de Alimentos · ERP
          </p>
        </div>
      </div>
    </footer>
  );
}
