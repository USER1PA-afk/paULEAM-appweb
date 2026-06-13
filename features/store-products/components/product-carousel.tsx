"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { getInsforge } from "@shared/lib/insforge/client";
import type { StoreProduct } from "../hooks/index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns offset relative to current, wrapped into range [-floor(n/2), ceil(n/2)]. */
function getOffset(idx: number, current: number, total: number): number {
  let off = idx - current;
  if (off > total / 2) off -= total;
  if (off < -total / 2) off += total;
  return off;
}

const fmt = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CarouselSkeleton() {
  return (
    <div className="relative h-[420px] sm:h-[460px] flex items-center justify-center">
      <div className="w-[80vw] max-w-[500px] h-full rounded-3xl bg-muted animate-pulse" />
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function ProductCarousel() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ──
  useEffect(() => {
    const db = getInsforge();
    db.database
      .from("products")
      .select(
        "id,name,sku,type,unit,capacity_unit,price,image_url,short_description,featured,is_active,description,long_description,specifications,ingredients,nutritional_info,weight,commercial_details,category_id,created_at,updated_at"
      )
      .eq("type", "PRODUCTO_TERMINADO")
      .eq("is_active", true)
      .gt("price", 0)
      .order("featured", { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data, error }: { data: any; error: any }) => {
        if (!error && Array.isArray(data)) setProducts(data as StoreProduct[]);
        setLoading(false);
      });
  }, []);

  // ── Auto-scroll ──
  const resetTimer = useCallback(
    (len: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (len <= 1) return;
      timerRef.current = setInterval(() => {
        setCurrent((c) => (c + 1) % len);
      }, 5000);
    },
    []
  );

  useEffect(() => {
    resetTimer(products.length);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [products.length, resetTimer]);

  // ── Navigation ──
  const go = useCallback(
    (dir: 1 | -1) => {
      setCurrent((c) => (c + dir + products.length) % products.length);
      resetTimer(products.length);
    },
    [products.length, resetTimer]
  );

  const goTo = useCallback(
    (idx: number) => {
      setCurrent(idx);
      resetTimer(products.length);
    },
    [products.length, resetTimer]
  );

  if (loading) return <CarouselSkeleton />;
  if (!products.length) return null;

  const single = products.length === 1;

  return (
    <div className="select-none space-y-5">

      {/* ── Stage ── */}
      <div
        className="relative h-[420px] sm:h-[460px] overflow-hidden"
        role="region"
        aria-label="Productos destacados"
        aria-roledescription="carrusel"
      >

        {/* Cards */}
        {products.map((product, idx) => {
          const off = getOffset(idx, current, products.length);
          const isActive = off === 0;
          // Only render center + immediate neighbors
          const visible = Math.abs(off) <= 1;

          // Styles per offset position
          const translateX = off * 78; // % of container, side cards shift left/right
          const scale = isActive ? 1 : 0.82;
          const opacity = isActive ? 1 : 0.55;
          const blur = isActive ? 0 : 8;
          const zIndex = isActive ? 10 : 5;

          return (
            <div
              key={product.id}
              aria-hidden={!isActive}
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                width: "min(80vw, 500px)",
                height: "100%",
                transform: `translateX(calc(-50% + ${translateX}%)) scale(${scale})`,
                opacity: visible ? opacity : 0,
                filter: `blur(${blur}px)`,
                zIndex,
                transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1), opacity 0.55s ease, filter 0.55s ease",
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              <Link
                href="/shop/catalog"
                tabIndex={isActive ? 0 : -1}
                className="flex flex-col h-full rounded-3xl border border-border bg-card shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300"
              >
                {/* Image */}
                <div className="relative flex-1 bg-muted overflow-hidden">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-brand-50 dark:bg-brand-900/20">
                      <ShoppingBag
                        aria-hidden="true"
                        className="h-16 w-16 text-brand-200 dark:text-brand-700"
                      />
                    </div>
                  )}

                  {/* Featured badge */}
                  {product.featured && (
                    <span className="absolute top-3 left-3 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                      Destacado
                    </span>
                  )}

                  {/* Liquid glass info panel — includes price */}
                  <div className="absolute bottom-0 left-0 right-0 m-3 rounded-2xl overflow-hidden">
                    <div className="backdrop-blur-md bg-white/25 dark:bg-black/45 border border-white/40 dark:border-white/10 shadow-lg px-4 py-3 space-y-0.5">
                      <h3 className="font-extrabold text-lg leading-tight text-white drop-shadow-sm line-clamp-1">
                        {product.name}
                      </h3>
                      {product.short_description && (
                        <p className="text-xs text-white/75 drop-shadow-sm line-clamp-1">
                          {product.short_description}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1.5">
                        <span className="text-xl font-extrabold text-white drop-shadow-sm">
                          {fmt.format(product.price)}
                          {(product.capacity_unit || product.unit) && (
                            <span className="text-sm font-semibold ml-1 text-white/75">
                              / {product.capacity_unit || product.unit}
                            </span>
                          )}
                        </span>
                        <span className="rounded-full bg-brand-600/90 border border-white/20 px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                          Ver →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}

        {/* Arrows — only when > 1 product */}
        {!single && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Producto anterior"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 backdrop-blur-sm shadow-md hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-all cursor-pointer"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5 text-foreground" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Producto siguiente"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 backdrop-blur-sm shadow-md hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-all cursor-pointer"
            >
              <ChevronRight aria-hidden="true" className="h-5 w-5 text-foreground" />
            </button>
          </>
        )}
      </div>

      {/* ── Dot indicators ── */}
      {!single && (
        <div className="flex justify-center gap-2" role="tablist" aria-label="Ir al producto">
          {products.map((_, idx) => (
            <button
              key={idx}
              role="tab"
              aria-selected={idx === current}
              aria-label={`Producto ${idx + 1}`}
              onClick={() => goTo(idx)}
              className={[
                "h-2 rounded-full transition-all duration-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-500",
                idx === current
                  ? "w-6 bg-brand-600 dark:bg-brand-400"
                  : "w-2 bg-border hover:bg-brand-300 dark:hover:bg-brand-700",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
