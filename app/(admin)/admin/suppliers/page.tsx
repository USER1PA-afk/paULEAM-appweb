"use client";

import { useState, useMemo } from "react";
import { SuppliersTable, SupplierForm } from "@features/suppliers/components";
import { useAllSuppliers, useSupplierActions } from "@features/suppliers/hooks";
import type { Supplier } from "@entities/supplier";
import { useRole } from "@features/auth/hooks";
import { RequestDeletionDialog } from "@features/deletion-requests";
import { CircleCheck, Search, X as XIcon, Archive } from "lucide-react";

export default function AdminSuppliersPage() {
  const { suppliers, loading, error, refetch } = useAllSuppliers();
  const { toggleActive } = useSupplierActions();
  const { role } = useRole();
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "operario";
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  const filteredSuppliers = useMemo(() => {
    const baseList = showArchived ? suppliers : suppliers.filter((s) => s.is_active);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      (s) =>
        (s.company ?? "").toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.ruc ?? "").toLowerCase().includes(q)
    );
  }, [suppliers, searchQuery, showArchived]);

  const archivedCount = useMemo(
    () => suppliers.filter((s) => !s.is_active).length,
    [suppliers]
  );

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  async function handleToggle(id: string, current: boolean) {
    if (!isAdmin) return;
    await toggleActive(id, current);
    refetch();
    flash(`Proveedor ${current ? "desactivado" : "activado"}.`);
  }

  function handleEdit(s: Supplier) {
    setEditing(s);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSuccess(s: Supplier) {
    setShowForm(false);
    setEditing(null);
    refetch();
    flash(`Proveedor "${s.company ?? s.name}" guardado correctamente.`);
  }

  function handleCancel() {
    setShowForm(false);
    setEditing(null);
  }

  function handleRequestDelete(s: Supplier) {
    setDeletingSupplier(s);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Gestión de proveedores de materias primas."
              : "Gestión de proveedores. Las eliminaciones requieren aprobación de un administrador."}
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => {
              if (showForm && !editing) {
                setShowForm(false);
              } else {
                setEditing(null);
                setShowForm(true);
              }
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            {showForm && !editing ? "Cancelar" : "+ Nuevo Proveedor"}
          </button>
        )}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-md bg-brand-50 border border-brand-200 px-4 py-3 text-sm font-medium text-brand-700 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-300">
          <CircleCheck className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Form create/edit */}
      {showForm && (
        <SupplierForm
          initial={editing ?? undefined}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filters + archived toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {!loading && suppliers.length > 0 && (
          <div className="relative max-w-md flex-1 min-w-[240px]">
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar proveedor por nombre, empresa o RUC…"
              className="w-full rounded-md border border-border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {archivedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              showArchived
                ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            {showArchived ? "Ocultar archivados" : `Mostrar archivados (${archivedCount})`}
          </button>
        )}
      </div>

      {searchQuery && (
        <p className="text-xs text-muted-foreground -mt-3">
          {filteredSuppliers.length} resultado{filteredSuppliers.length !== 1 ? "s" : ""} para &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : filteredSuppliers.length === 0 && searchQuery ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Sin resultados para &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <SuppliersTable
          suppliers={filteredSuppliers}
          onToggle={isAdmin ? handleToggle : null}
          onEdit={isStaff ? handleEdit : null}
          onRequestDelete={isStaff ? handleRequestDelete : null}
        />
      )}

      <RequestDeletionDialog
        open={!!deletingSupplier}
        onClose={() => setDeletingSupplier(null)}
        onSubmitted={() => refetch()}
        entityType="supplier"
        entityId={deletingSupplier?.id ?? ""}
        entityLabel={deletingSupplier ? (deletingSupplier.company ?? deletingSupplier.name) : ""}
      />
    </div>
  );
}
