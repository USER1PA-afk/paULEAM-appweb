import React from "react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-center px-6 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()}{" "}
          <span className="font-semibold text-brand-600">ULEAM</span>
          {" "}· Planta de Alimentos · ERP
        </p>
      </div>
    </footer>
  );
}
