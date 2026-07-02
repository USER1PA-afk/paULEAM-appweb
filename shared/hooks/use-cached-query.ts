"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useCachedQuery — caché de consultas en memoria con stale-while-revalidate.
 *
 * PROBLEMA QUE RESUELVE:
 *   Los hooks de datos (useStockSummary, useProductionOrders, etc.) viven en
 *   páginas cliente que se desmontan y remontan en cada navegación. Sin caché,
 *   cada navegación del admin repetía TODAS las consultas a Insforge aunque
 *   los datos no hubieran cambiado.
 *
 * COMPORTAMIENTO:
 *   - Caché a nivel de módulo (Map). Vive mientras viva la pestaña; se pierde
 *     con recarga completa o logout (window.location.replace) — correcto,
 *     porque un usuario nuevo no debe ver datos del anterior.
 *   - Entrada fresca (edad < ttlMs): se sirve de caché, CERO red.
 *   - Entrada vencida: se sirve de caché al instante (sin spinner) y se
 *     revalida en segundo plano (stale-while-revalidate).
 *   - Sin entrada: loading=true + fetch normal.
 *   - Deduplicación: peticiones concurrentes a la misma key comparten una
 *     única promesa en vuelo.
 *   - refetch() fuerza red, actualiza la caché y sincroniza cualquier otro
 *     componente montado suscrito a la misma key.
 *
 * INVALIDACIÓN (obligatoria tras mutaciones):
 *   invalidateCache("stock_summary", "inventory_ledger") borra las entradas
 *   cuya key sea igual al prefijo o empiece con `${prefijo}:` y hace que los
 *   hooks montados vuelvan a pedir. Toda mutación que escriba en una tabla
 *   cacheada DEBE invalidar sus keys — nunca dejar stock stale en un ERP.
 */

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

const DEFAULT_TTL_MS = 60_000;

function notify(key: string) {
  listeners.get(key)?.forEach((cb) => cb());
}

/**
 * Borra las entradas que coincidan con cada prefijo (igualdad exacta o
 * `${prefijo}:…`) y notifica a los hooks montados para que refetcheen.
 */
export function invalidateCache(...prefixes: string[]) {
  const matches = (key: string) =>
    prefixes.some((p) => key === p || key.startsWith(p + ":"));

  const toNotify = new Set<string>();
  for (const key of Array.from(cache.keys())) {
    if (matches(key)) {
      cache.delete(key);
      toNotify.add(key);
    }
  }
  // Suscriptores cuya key coincide pero aún no tiene entrada (fetch en vuelo
  // o fallido) también deben reintentar.
  for (const key of listeners.keys()) {
    if (matches(key)) toNotify.add(key);
  }
  toNotify.forEach(notify);
}

interface CachedQueryOptions {
  /** Edad máxima para servir de caché sin revalidar. Default: 60 s. */
  ttlMs?: number;
  /** Si es false, el hook no hace nada (útil para queries condicionales). */
  enabled?: boolean;
}

export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  { ttlMs = DEFAULT_TTL_MS, enabled = true }: CachedQueryOptions = {}
) {
  const [data, setData] = useState<T | null>(() => {
    const entry = cache.get(key);
    return entry ? (entry.data as T) : null;
  });
  const [loading, setLoading] = useState(enabled && !cache.has(key));
  const [error, setError] = useState<string | null>(null);

  // El fetcher suele cerrar sobre props/estado del caller; la ref evita que
  // su identidad cambiante reinicie el efecto o dispare fetchs extra.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(
    async (force: boolean) => {
      const entry = cache.get(key);
      const isFresh = !!entry && Date.now() - entry.fetchedAt < ttlMs;

      if (entry) {
        setData(entry.data as T);
        setLoading(false);
        if (!force && isFresh) return; // hit fresco → cero red
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        let promise = inflight.get(key) as Promise<T> | undefined;
        if (!promise) {
          promise = fetcherRef.current().finally(() => inflight.delete(key));
          inflight.set(key, promise);
        }
        const result = await promise;
        cache.set(key, { data: result, fetchedAt: Date.now() });
        setData(result);
        notify(key);
      } catch (err: unknown) {
        // Si había datos stale se conservan en pantalla; solo se reporta el error.
        setError(err instanceof Error ? err.message : "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    },
    [key, ttlMs]
  );

  useEffect(() => {
    if (!enabled) return;

    let subs = listeners.get(key);
    if (!subs) {
      subs = new Set();
      listeners.set(key, subs);
    }
    const onCacheChange = () => {
      const entry = cache.get(key);
      if (entry) {
        // Otro hook ya trajo datos frescos — sincronizar sin pedir de nuevo.
        setData(entry.data as T);
        setLoading(false);
      } else {
        // Invalidación — volver a pedir (deduplicado por inflight).
        load(true);
      }
    };
    subs.add(onCacheChange);

    // setState síncrono intencional: al cambiar la key hay que sincronizar el
    // estado con la caché antes del primer paint para no mostrar datos de la
    // key anterior (mismo patrón que el resto de hooks de datos del repo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false);

    return () => {
      subs.delete(onCacheChange);
      if (subs.size === 0) listeners.delete(key);
    };
  }, [key, enabled, load]);

  const refetch = useCallback(() => load(true), [load]);

  return { data, loading, error, refetch };
}
