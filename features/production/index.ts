/**
 * Feature: Production (Producción)
 *
 * Motor de escalado de recetas. Las órdenes de producción al completarse
 * ejecutan triggers PL/pgSQL que escalan ingredientes y registran movimientos
 * atómicos en inventory_ledger.
 *
 * Exports:
 * - Components: formularios de orden, vista de recetas
 * - Hooks: useProductionOrders, useRecipeScale
 * - Lib: funciones de cálculo y acceso a datos
 */

export {};
