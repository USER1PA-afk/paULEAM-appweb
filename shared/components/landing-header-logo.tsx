"use client";

import { useEffect, useState } from "react";

/**
 * Logo de Panchito en el encabezado de la landing.
 * Se oculta mientras el logo grande del hero (marcado con `data-hero-panchito`)
 * esté visible en pantalla, y aparece al hacer scroll cuando éste sale de vista.
 */
export function LandingHeaderLogo() {
  // Arranca oculto: en la carga inicial el hero está visible.
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-hero-panchito]"),
    );

    // Sin hero (no debería pasar) → mostrar siempre.
    if (targets.length === 0) {
      setHidden(false);
      return;
    }

    const visibility = new Map<Element, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target, entry.isIntersecting);
        }
        // Oculto en el header si algún hero Panchito sigue visible.
        const anyVisible = Array.from(visibility.values()).some(Boolean);
        setHidden(anyVisible);
      },
      { threshold: 0 },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return (
    <span
      aria-hidden={hidden}
      className={`overflow-hidden transition-all duration-300 ease-out ${
        hidden ? "w-0 opacity-0" : "w-[109px] opacity-100"
      }`}
    >
      <picture>
        <source srcSet="/PANCHITOS_logo_page-0001.webp" type="image/webp" />
        {/* Raw <img> on purpose: the file is already a pre-optimized .webp
            (see scripts/generate-static-webp.mjs), so we skip next/image
            entirely. Wrapping next/image in <picture> also breaks SSR
            hydration because the optimizer emits attributes the client
            tree doesn't reproduce. */}
        <img
          src="/PANCHITOS_logo_page-0001.png"
          alt="Logo Panchitos"
          width={109}
          height={36}
          className="shrink-0 object-contain dark:drop-shadow-[0_0_3px_rgba(255,255,255,0.95)]"
        />
      </picture>
    </span>
  );
}
