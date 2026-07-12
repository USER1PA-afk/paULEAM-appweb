/**
 * Feature: Production (Producción)
 *
 * Motor de escalado de recetas. Las órdenes de producción al completarse
 * ejecutan triggers PL/pgSQL que escalan ingredientes y registran movimientos
 * atómicos en inventory_ledger.
 *
 * Flujo unificado (nuevo): useUnifiedOrders / useUnifiedPresentations /
 * useUnifiedIngredients / useFinishedProducts.
 */

export * from "./components";
export * from "./hooks";
export * from "./hooks/use-unified-production";
export * from "./lib";
