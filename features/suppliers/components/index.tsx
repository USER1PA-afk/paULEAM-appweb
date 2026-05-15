"use client";

import { useState, useEffect } from "react";
import { useSuppliers, useSupplierActions } from "@features/suppliers/hooks";
import type { Supplier, CreateSupplier } from "@entities/supplier";
import { Plus, X, Handshake } from "lucide-react";

// ─────────────────────────────────────────────────────────
// SupplierQuickAddForm — inline modal para crear proveedor sin salir del form
// ─────────────────────────────────────────────────────────
interface SupplierQuickAddFormProps {
  onCreated: (supplier: Supplier) => void;
  onCancel: () => void;
}

export function SupplierQuickAddForm({ onCreated, onCancel }: SupplierQuickAddFormProps) {
  const { createSupplier, loading, error } = useSupplierActions();
  const [nameError, setNameError] = useState("");
  const [form, setForm] = useState<CreateSupplier>({
    name: "",
    company: "",
    ruc: "",
    email: "",
    phone: "",
    is_active: true,
  });

  // No <form> here — this component is always rendered inside the product <form>.
  // Validation is manual; submit fires via onClick.
  async function handleCreate() {
    if (!form.name.trim()) {
      setNameError("El nombre es requerido.");
      return;
    }
    setNameError("");
    const { data } = await createSupplier(form);
    if (data) onCreated(data);
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm space-y-3 dark:bg-brand-900/20 dark:border-brand-800">
      <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
        <Plus className="h-4 w-4" /> Nuevo Proveedor
      </p>
      {/* Plain div — NOT a form, to avoid nested <form> hydration error */}
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Nombre contacto *
            </label>
            <input
              value={form.name}
              onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setNameError(""); }}
              placeholder="Juan Pérez"
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                nameError ? "border-destructive" : "border-border"
              }`}
            />
            {nameError && <p className="text-[10px] text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Empresa / Razón social
            </label>
            <input
              value={form.company ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
              placeholder="Frutas del Valle S.A."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">RUC</label>
            <input
              value={form.ruc ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, ruc: e.target.value }))}
              placeholder="1234567890001"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
            <input
              value={form.phone ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="0999 123 456"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Email de contacto
            </label>
            <input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="proveedor@empresa.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Guardando..." : "Crear proveedor"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SupplierSelect — multi-select con primario para form de producto
// ─────────────────────────────────────────────────────────
interface SupplierSelectProps {
  /** IDs de proveedores seleccionados */
  selectedIds: string[];
  /** ID del proveedor primario */
  primaryId: string;
  onChange: (selectedIds: string[], primaryId: string) => void;
}

export function SupplierSelect({ selectedIds, primaryId, onChange }: SupplierSelectProps) {
  const { suppliers, loading } = useSuppliers();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>([]);

  // Merge fetched suppliers con los recién creados en sesión
  useEffect(() => {
    setLocalSuppliers(suppliers);
  }, [suppliers]);

  function toggleSupplier(id: string) {
    let next: string[];
    if (selectedIds.includes(id)) {
      next = selectedIds.filter((s) => s !== id);
    } else {
      next = [...selectedIds, id];
    }

    // Auto-primario si solo queda 1
    let nextPrimary = primaryId;
    if (next.length === 1) {
      nextPrimary = next[0];
    } else if (!next.includes(nextPrimary)) {
      nextPrimary = "";
    }
    onChange(next, nextPrimary);
  }

  function setPrimary(id: string) {
    onChange(selectedIds, id);
  }

  function handleQuickAdded(supplier: Supplier) {
    setLocalSuppliers((prev) => [...prev, supplier]);
    setShowQuickAdd(false);
    // Auto-seleccionar el recién creado
    const next = [...selectedIds, supplier.id];
    const nextPrimary = next.length === 1 ? supplier.id : primaryId;
    onChange(next, nextPrimary);
  }

  const needsPrimarySelection = selectedIds.length > 1 && !primaryId;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Proveedores *
          <span className="ml-1 text-[10px] text-muted-foreground/70">
            (selecciona uno o más)
          </span>
        </label>
        <button
          type="button"
          onClick={() => setShowQuickAdd((v) => !v)}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
        >
          {showQuickAdd ? (
            <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Cancelar</span>
          ) : (
            <span className="inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Nuevo proveedor</span>
          )}
        </button>
      </div>

      {showQuickAdd && (
        <SupplierQuickAddForm
          onCreated={handleQuickAdded}
          onCancel={() => setShowQuickAdd(false)}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          Cargando proveedores...
        </div>
      ) : localSuppliers.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No hay proveedores activos. Crea uno con el botón de arriba.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {localSuppliers.map((s) => {
            const selected = selectedIds.includes(s.id);
            const isPrimary = primaryId === s.id;
            return (
              <label
                key={s.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                  selected
                    ? "border-brand-400 bg-brand-50/60 dark:bg-brand-900/20 dark:border-brand-700"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSupplier(s.id)}
                  className="mt-0.5 accent-brand-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {s.company ?? s.name}
                  </p>
                  {s.company && (
                    <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                  )}
                  {s.ruc && (
                    <p className="text-[10px] text-muted-foreground/70">
                      RUC: {s.ruc}
                    </p>
                  )}
                </div>
                {selected && selectedIds.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPrimary(s.id);
                    }}
                    title="Marcar como primario"
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      isPrimary
                        ? "bg-brand-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-brand-100 hover:text-brand-700"
                    }`}
                  >
                    {isPrimary ? "Principal" : "Marcar principal"}
                  </button>
                )}
                {selected && selectedIds.length === 1 && (
                  <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Principal
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}

      {needsPrimarySelection && (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
          Con múltiples proveedores, debes seleccionar cuál es el principal.
        </p>
      )}

      {selectedIds.length === 0 && (
        <p className="text-xs text-destructive">
          Selecciona al menos un proveedor para materia prima.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SuppliersTable — tabla admin CRUD para /admin/suppliers
// ─────────────────────────────────────────────────────────
export function SuppliersTable({
  suppliers,
  onToggle,
  onEdit,
}: {
  suppliers: Supplier[];
  onToggle: (id: string, current: boolean) => void;
  onEdit: (s: Supplier) => void;
}) {
  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Handshake className="h-10 w-10 mb-3 opacity-25" />
        <p className="text-sm">No hay proveedores registrados.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Empresa</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Contacto</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">RUC</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Teléfono</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Email</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr
              key={s.id}
              className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <p className="font-medium">{s.company ?? s.name}</p>
                {s.company && (
                  <p className="text-xs text-muted-foreground sm:hidden">{s.name}</p>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                {s.name}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                {s.ruc ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                {s.phone ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                {s.email ? (
                  <a
                    href={`mailto:${s.email}`}
                    className="text-brand-600 hover:underline"
                  >
                    {s.email}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    s.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {s.is_active ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(s)}
                    className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onToggle(s.id, s.is_active)}
                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      s.is_active
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-green-200 text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {s.is_active ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SupplierForm — form de creación / edición
// ─────────────────────────────────────────────────────────
interface SupplierFormProps {
  initial?: Supplier;
  onSuccess: (s: Supplier) => void;
  onCancel: () => void;
}

export function SupplierForm({ initial, onSuccess, onCancel }: SupplierFormProps) {
  const { createSupplier, updateSupplier, loading, error } = useSupplierActions();
  const [form, setForm] = useState<CreateSupplier>({
    name: initial?.name ?? "",
    company: initial?.company ?? "",
    ruc: initial?.ruc ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
    is_active: initial?.is_active ?? true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (initial) {
      const { error: err } = await updateSupplier(initial.id, form);
      if (!err) onSuccess({ ...initial, ...form });
    } else {
      const { data } = await createSupplier(form);
      if (data) onSuccess(data);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
    >
      <h3 className="text-lg font-semibold">
        {initial ? "Editar Proveedor" : "Nuevo Proveedor"}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Nombre contacto *
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Juan Pérez"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Empresa / Razón social
          </label>
          <input
            value={form.company ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
            placeholder="Frutas del Valle S.A."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">RUC</label>
          <input
            value={form.ruc ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, ruc: e.target.value }))}
            placeholder="1234567890001"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Email de contacto
          </label>
          <input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="proveedor@empresa.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
          <input
            value={form.phone ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="0999 123 456"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Dirección</label>
          <input
            value={form.address ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            placeholder="Av. Principal 123, Quito"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <label className="text-xs font-medium text-muted-foreground">Notas</label>
          <input
            value={form.notes ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Notas adicionales"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Guardando..." : initial ? "Actualizar" : "Crear Proveedor"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
