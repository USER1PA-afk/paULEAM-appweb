"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import { formatDate } from "@shared/lib/utils";
import { Shield, Wrench, Monitor, ShoppingBag, ChevronDown, Trash2, AlertTriangle, X } from "lucide-react";
import { usePagination } from "@shared/hooks/use-pagination";
import { TablePagination } from "@shared/components/ui/table-pagination";
import { useRole } from "@features/auth/hooks";

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLES: Record<string, {
  label: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  description: string;
  permissions: string[];
  Icon: React.ElementType;
}> = {
  admin: {
    label: "Administrador",
    dot: "bg-brand-600",
    badgeBg: "bg-brand-100 dark:bg-brand-900/40",
    badgeText: "text-brand-700 dark:text-brand-300",
    cardBg: "bg-brand-50 dark:bg-brand-950/20",
    cardBorder: "border-brand-200 dark:border-brand-800/60",
    cardText: "text-brand-700 dark:text-brand-300",
    description: "Control total del sistema ERP",
    permissions: ["Dashboard", "Inventario", "Producción", "Órdenes", "Usuarios", "Tienda", "POS"],
    Icon: Shield,
  },
  operario: {
    label: "Operario",
    dot: "bg-blue-500",
    badgeBg: "bg-blue-100 dark:bg-blue-900/40",
    badgeText: "text-blue-700 dark:text-blue-300",
    cardBg: "bg-blue-50 dark:bg-blue-950/20",
    cardBorder: "border-blue-200 dark:border-blue-800/60",
    cardText: "text-blue-700 dark:text-blue-300",
    description: "Gestión de planta industrial",
    permissions: ["Inventario", "Producción"],
    Icon: Wrench,
  },
  sales_kiosk: {
    label: "Kiosco POS",
    dot: "bg-violet-500",
    badgeBg: "bg-violet-100 dark:bg-violet-900/40",
    badgeText: "text-violet-700 dark:text-violet-300",
    cardBg: "bg-violet-50 dark:bg-violet-950/20",
    cardBorder: "border-violet-200 dark:border-violet-800/60",
    cardText: "text-violet-700 dark:text-violet-300",
    description: "Acceso exclusivo al Punto de Venta",
    permissions: ["POS"],
    Icon: Monitor,
  },
  cliente: {
    label: "Cliente",
    dot: "bg-amber-500",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40",
    badgeText: "text-amber-700 dark:text-amber-300",
    cardBg: "bg-amber-50 dark:bg-amber-950/20",
    cardBorder: "border-amber-200 dark:border-amber-800/60",
    cardText: "text-amber-700 dark:text-amber-300",
    description: "Acceso al e-commerce público",
    permissions: ["Catálogo", "Carrito", "Mis Órdenes"],
    Icon: ShoppingBag,
  },
};

const STAFF_ROLES = ["admin", "operario", "sales_kiosk"];

// ── Delete Confirmation Modal ─────────────────────────────────────────────────

interface DeleteModalProps {
  user: UserProfile | null;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
  deleteError: string | null;
}

function DeleteConfirmModal({ user, onConfirm, onCancel, deleting, deleteError }: DeleteModalProps) {
  if (!user) return null;

  const roleLabel = ROLES[user.role]?.label ?? user.role;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
            <AlertTriangle aria-hidden="true" className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h2 id="delete-modal-title" className="text-base font-semibold text-foreground">
              Eliminar personal del sistema
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estás a punto de eliminar a{" "}
              <span className="font-semibold text-foreground">{user.full_name}</span>{" "}
              ({roleLabel}).
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Warning box */}
        <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/50 dark:bg-red-950/30">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-1">
            ⚠ Acción irreversible
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            Una vez eliminado, el usuario perderá acceso inmediatamente y{" "}
            <strong>no será posible recuperar su cuenta ni su historial de acceso</strong>.
            Esta acción no se puede deshacer.
          </p>
        </div>

        {deleteError && (
          <div className="mx-6 mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{deleteError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            id="delete-modal-cancel"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            id="delete-modal-confirm"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-60"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            {deleting ? "Eliminando…" : "Sí, eliminar usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Role Badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const def = ROLES[role] ?? { label: role, dot: "bg-gray-400", badgeBg: "bg-gray-100", badgeText: "text-gray-700" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${def.badgeBg} ${def.badgeText}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${def.dot}`} />
      {def.label}
    </span>
  );
}

// ── User Row ──────────────────────────────────────────────────────────────────

function UserRow({
  u,
  isEditing,
  editRole,
  saving,
  showDelete,
  onEdit,
  onCancel,
  onSave,
  onRoleChange,
  onDeleteRequest,
}: {
  u: UserProfile;
  isEditing: boolean;
  editRole: string;
  saving: boolean;
  showDelete: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onRoleChange: (r: string) => void;
  onDeleteRequest: () => void;
}) {
  const initials = u.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-400 to-brand-600 text-xs font-bold text-white select-none">
            {initials}
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">{u.full_name}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{u.id.substring(0, 12)}…</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        {isEditing ? (
          <div className="relative inline-block">
            <select
              value={editRole}
              onChange={(e) => onRoleChange(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-background pl-3 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            >
              <option value="admin">Administrador</option>
              <option value="operario">Operario</option>
              <option value="sales_kiosk">Kiosco POS</option>
              <option value="cliente">Cliente</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          </div>
        ) : (
          <RoleBadge role={u.role} />
        )}
      </td>
      <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap tabular-nums">
        {formatDate(u.created_at)}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          title={u.is_active ? "Activo" : "Inactivo"}
          className={`inline-flex h-2 w-2 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-red-500"}`}
        />
      </td>
      <td className="px-4 py-3 text-center">
        {isEditing ? (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={onCancel}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={onEdit}
              className="rounded-md bg-zinc-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-500 dark:hover:bg-zinc-400 transition-colors"
            >
              Editar rol
            </button>
            {showDelete && (
              <button
                id={`delete-staff-${u.id}`}
                onClick={onDeleteRequest}
                title="Eliminar usuario del sistema"
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
              >
                <Trash2 aria-hidden="true" className="h-3 w-3" />
                Eliminar
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Users Table ───────────────────────────────────────────────────────────────

function UsersTable({
  users,
  editingId,
  editRole,
  saving,
  showDeleteButtons,
  onEdit,
  onCancel,
  onSave,
  onRoleChange,
  onDeleteRequest,
  emptyMessage,
}: {
  users: UserProfile[];
  editingId: string | null;
  editRole: string;
  saving: boolean;
  showDeleteButtons: boolean;
  onEdit: (u: UserProfile) => void;
  onCancel: () => void;
  onSave: (id: string) => void;
  onRoleChange: (r: string) => void;
  onDeleteRequest: (u: UserProfile) => void;
  emptyMessage: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuario</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Rol</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Registrado</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground italic">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            users.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                isEditing={editingId === u.id}
                editRole={editRole}
                saving={saving}
                showDelete={showDeleteButtons}
                onEdit={() => onEdit(u)}
                onCancel={onCancel}
                onSave={() => onSave(u.id)}
                onRoleChange={onRoleChange}
                onDeleteRequest={() => onDeleteRequest(u)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const insforge = getInsforge();
  const { isAdmin } = useRole();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await insforge.database
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers((data as UserProfile[]) ?? []);
    setLoading(false);
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleRoleUpdate(userId: string) {
    setSaving(true);
    const { error } = await insforge.database
      .from("profiles")
      .update({ role: editRole })
      .eq("id", userId);
    setSaving(false);
    if (!error) {
      setEditingId(null);
      fetchUsers();
    }
  }

  function startEdit(u: UserProfile) {
    setEditingId(u.id);
    setEditRole(u.role);
  }

  function openDeleteModal(u: UserProfile) {
    setDeleteTarget(u);
    setDeleteError(null);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/admin/delete-staff-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });

      const json = await res.json();

      if (!res.ok) {
        setDeleteError(json?.error ?? "Error al eliminar el usuario. Inténtalo de nuevo.");
        return;
      }

      // Success — close modal and refresh list
      setDeleteTarget(null);
      setDeleteError(null);
      fetchUsers();
    } catch {
      setDeleteError("Error de red. Por favor, inténtalo de nuevo.");
    } finally {
      setDeleting(false);
    }
  }

  const staffUsers = users.filter((u) => STAFF_ROLES.includes(u.role));
  const clientUsers = users.filter((u) => u.role === "cliente");
  const staffPag = usePagination(staffUsers);
  const clientPag = usePagination(clientUsers);

  return (
    <>
      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        user={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteModal}
        deleting={deleting}
        deleteError={deleteError}
      />

      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra roles y permisos de los usuarios del sistema.
          </p>
        </div>

        {/* Role legend */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Roles del Sistema
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(ROLES).map(([key, def]) => {
              const Icon = def.Icon;
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-3.5 ${def.cardBg} ${def.cardBorder}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon aria-hidden="true" className={`h-4 w-4 ${def.cardText}`} />
                    <span className={`text-xs font-semibold ${def.cardText}`}>{def.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2.5">{def.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {def.permissions.map((p) => (
                      <span
                        key={p}
                        className="rounded-sm bg-background/70 border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div role="status" className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600">
              <span className="sr-only">Cargando usuarios…</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Staff table */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Personal del Sistema</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {staffUsers.length}
                </span>
                {isAdmin && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-medium text-red-600 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400">
                    <Shield aria-hidden="true" className="h-3 w-3" />
                    Solo tú puedes eliminar personal
                  </span>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <UsersTable
                  users={staffPag.paged}
                  editingId={editingId}
                  editRole={editRole}
                  saving={saving}
                  showDeleteButtons={isAdmin}
                  onEdit={startEdit}
                  onCancel={() => setEditingId(null)}
                  onSave={handleRoleUpdate}
                  onRoleChange={setEditRole}
                  onDeleteRequest={openDeleteModal}
                  emptyMessage="No hay administradores, operarios ni kioscos registrados."
                />
                <TablePagination
                  page={staffPag.page}
                  totalPages={staffPag.totalPages}
                  from={staffPag.from}
                  to={staffPag.to}
                  total={staffPag.total}
                  onPageChange={staffPag.setPage}
                />
              </div>
            </section>

            {/* Client table */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Clientes Registrados</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {clientUsers.length}
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <UsersTable
                  users={clientPag.paged}
                  editingId={editingId}
                  editRole={editRole}
                  saving={saving}
                  showDeleteButtons={false}
                  onEdit={startEdit}
                  onCancel={() => setEditingId(null)}
                  onSave={handleRoleUpdate}
                  onRoleChange={setEditRole}
                  onDeleteRequest={() => {}}
                  emptyMessage="No hay clientes registrados aún."
                />
                <TablePagination
                  page={clientPag.page}
                  totalPages={clientPag.totalPages}
                  from={clientPag.from}
                  to={clientPag.to}
                  total={clientPag.total}
                  onPageChange={clientPag.setPage}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
