"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import { formatDate } from "@shared/lib/utils";

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  admin: { label: "Administrador", className: "bg-brand-100 text-brand-700" },
  operario: { label: "Operario", className: "bg-blue-100 text-blue-700" },
  cliente: { label: "Cliente", className: "bg-amber-100 text-amber-700" },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const insforge = getInsforge();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await insforge.database
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setUsers((data as UserProfile[]) ?? []);
    setLoading(false);
  }, [insforge]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleRoleUpdate(userId: string) {
    await insforge.database
      .from("profiles")
      .update({ role: editRole })
      .eq("id", userId);
    setEditingId(null);
    fetchUsers();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra roles y permisos de los usuarios del sistema.
        </p>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Roles:
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-brand-100 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700">
              Administrador
            </span>
            <span className="text-xs text-muted-foreground">Control total del sistema</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
              Operario
            </span>
            <span className="text-xs text-muted-foreground">Inventario + Producción</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Cliente
            </span>
            <span className="text-xs text-muted-foreground">Solo e-commerce</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuario</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rol</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Registrado</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badge = ROLE_BADGES[u.role] ?? {
                  label: u.role,
                  className: "bg-gray-100 text-gray-700",
                };
                const isEditing = editingId === u.id;

                return (
                  <tr
                    key={u.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {u.id.substring(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="admin">Administrador</option>
                          <option value="operario">Operario</option>
                          <option value="cliente">Cliente</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${
                          u.is_active ? "bg-brand-500" : "bg-red-500"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRoleUpdate(u.id)}
                            className="rounded-md bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 transition-colors"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(u.id);
                            setEditRole(u.role);
                          }}
                          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                        >
                          Editar rol
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
