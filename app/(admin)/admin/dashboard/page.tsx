"use client";

import { useStockSummary } from "@features/inventory/hooks";
import { useProductionOrders } from "@features/production/hooks";
import { useOrderManagement } from "@features/checkout/hooks";
import Link from "next/link";
import {
  Tag,
  AlertTriangle,
  Settings2,
  ShoppingCart,
  PackagePlus,
  Wrench,
  Plus,
  ClipboardList,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  href,
  color = "brand",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  href: string;
  color?: "brand" | "blue" | "amber" | "red";
}) {
  const colorMap = {
    brand: "from-brand-500 to-brand-600",
    blue:  "from-blue-500 to-blue-600",
    amber: "from-amber-500 to-amber-600",
    red:   "from-red-500 to-red-600",
  };

  return (
    <Link href={href} className="group block">
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {value}
            </p>
            {trend && (
              <p className="text-xs text-muted-foreground">{trend}</p>
            )}
          </div>
          <div
            aria-hidden="true"
            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br ${colorMap[color]} text-white shadow-sm`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div
          className={`absolute bottom-0 left-0 h-0.5 w-full bg-linear-to-r ${colorMap[color]} opacity-0 transition-opacity group-hover:opacity-100`}
        />
      </div>
    </Link>
  );
}

function QuickAction({
  label,
  description,
  href,
  icon: Icon,
}: {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:shadow-sm hover:border-brand-200 hover:bg-brand-50/30 dark:hover:bg-brand-900/10"
    >
      <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const { summary, loading: stockLoading } = useStockSummary();
  const { orders: prodOrders, loading: prodLoading } = useProductionOrders();
  const { orders: salesOrders, loading: salesLoading } = useOrderManagement();
  const isLoading = stockLoading || prodLoading || salesLoading;

  const finishedGoods    = summary.filter((s) => s.type === "PRODUCTO_TERMINADO");
  const totalProducts    = finishedGoods.length;
  const lowStock         = finishedGoods.filter((s) => Number(s.stock_actual) < 10 && Number(s.stock_actual) > 0).length;
  const outOfStock       = finishedGoods.filter((s) => Number(s.stock_actual) <= 0).length;
  const pendingProduction = prodOrders.filter((o) => o.status === "BORRADOR" || o.status === "EN_PROCESO").length;
  const completedProduction = prodOrders.filter((o) => o.status === "COMPLETADA").length;
  const pendingSales     = salesOrders.filter((o) => o.status === "PAGADO").length;
  const totalSales       = salesOrders.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen general del sistema ERP — Planta de Alimentos Uleam
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton h-7 w-12" />
                  <div className="skeleton h-3 w-28" />
                </div>
                <div className="skeleton h-10 w-10 rounded-lg" />
              </div>
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Productos"
              value={totalProducts}
              icon={Tag}
              trend={`${outOfStock} sin stock`}
              href="/admin/products"
              color="brand"
            />
            <StatCard
              label="Stock Bajo"
              value={lowStock}
              icon={AlertTriangle}
              trend="Requieren atención"
              href="/admin/inventory"
              color="amber"
            />
            <StatCard
              label="Producción Activa"
              value={pendingProduction}
              icon={Settings2}
              trend={`${completedProduction} completadas`}
              href="/admin/production"
              color="blue"
            />
            <StatCard
              label="Ventas Pendientes"
              value={pendingSales}
              icon={ShoppingCart}
              trend={`${totalSales} total`}
              href="/admin/orders"
              color="red"
            />
          </>
        )}
      </div>

      {/* Two columns: Quick Actions + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Acciones Rápidas</h2>
          <div className="grid gap-3">
            <QuickAction
              label="Nuevo Ingreso de Stock"
              description="Registrar entrada de materia prima al inventario"
              href="/admin/inventory"
              icon={PackagePlus}
            />
            <QuickAction
              label="Crear Orden de Producción"
              description="Iniciar una nueva corrida de producción"
              href="/admin/production"
              icon={Wrench}
            />
            <QuickAction
              label="Registrar Producto"
              description="Agregar nuevo producto o materia prima"
              href="/admin/products"
              icon={Plus}
            />
            <QuickAction
              label="Ver Órdenes de Venta"
              description="Aprobar pagos y gestionar pedidos"
              href="/admin/orders"
              icon={ClipboardList}
            />
          </div>
        </div>

        {/* Stock Summary mini */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Stock — Productos Terminados</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {stockLoading ? (
              <div className="divide-y divide-border/50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-2 w-2 rounded-full" />
                      <div className="space-y-1.5">
                        <div className="skeleton h-3.5 w-32" />
                        <div className="skeleton h-3 w-16" />
                      </div>
                    </div>
                    <div className="space-y-1.5 items-end flex flex-col">
                      <div className="skeleton h-3.5 w-10" />
                      <div className="skeleton h-3 w-8" />
                    </div>
                  </div>
                ))}
              </div>
            ) : finishedGoods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No hay productos registrados</p>
                <Link
                  href="/admin/products"
                  className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Agregar primer producto →
                </Link>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {finishedGoods.slice(0, 8).map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between border-b border-border/50 px-4 py-3 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {Number(item.stock_actual) <= 0 ? (
                        <span aria-label="Sin stock" className="inline-flex h-2 w-2 rounded-full shrink-0 bg-red-500" />
                      ) : Number(item.stock_actual) < 10 ? (
                        <AlertTriangle aria-label="Stock bajo" className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      ) : (
                        <span aria-label="Stock OK" className="inline-flex h-2 w-2 rounded-full shrink-0 bg-accent-500" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                    </div>
                    <div className="text-right pl-4">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {Number(item.stock_actual).toLocaleString("es-EC", {
                          minimumFractionDigits: ["kg", "lt"].includes(item.unit?.toLowerCase() || "") ? 2 : 0,
                          maximumFractionDigits: 2,
                          useGrouping: false,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.unit}</p>
                    </div>
                  </div>
                ))}
                {finishedGoods.length > 8 && (
                  <Link
                    href="/admin/inventory"
                    className="block border-t border-border bg-muted/30 px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    Ver todos ({finishedGoods.length}) →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
