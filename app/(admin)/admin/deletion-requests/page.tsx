"use client";

import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@features/auth/hooks";
import {
  useDeletionRequests,
  useReviewDeletionRequest,
} from "@features/deletion-requests";
import {
  ENTITY_TYPE_LABELS,
  DeletionEntityType,
} from "@entities/deletion-request";
import {
  Check,
  X,
  Clock,
  Package,
  Handshake,
  Beaker,
  Search,
  MessageSquare,
} from "lucide-react";

type FilterStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const ENTITY_ICONS: Record<DeletionEntityType, typeof Package> = {
  product:  Package,
  supplier: Handshake,
  recipe:   Beaker,
};

export default function AdminDeletionRequestsPage() {
  const router = useRouter();
  const { role, loading: roleLoading } = useRole();
  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { requests, loading, refetch } = useDeletionRequests(filter);
  const { approve, reject, loading: reviewing } = useReviewDeletionRequest();

  // Operario cannot view this page
  useEffect(() => {
    if (!roleLoading && role && role !== "admin") {
      router.replace("/admin/dashboard");
    }
  }, [role, roleLoading, router]);

  if (roleLoading || (role && role !== "admin")) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  const filtered = requests.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.entity_label.toLowerCase().includes(q) ||
      (r.requester_name ?? "").toLowerCase().includes(q) ||
      (r.requester_email ?? "").toLowerCase().includes(q) ||
      (r.reason ?? "").toLowerCase().includes(q)
    );
  });

  async function handleApprove(id: string) {
    setActionError(null);
    const { error } = await approve(id);
    if (error) {
      setActionError(error);
      return;
    }
    refetch();
  }

  async function handleReject(id: string) {
    setActionError(null);
    const { error } = await reject(id, rejectNote || undefined);
    if (error) {
      setActionError(error);
      return;
    }
    setRejectingId(null);
    setRejectNote("");
    refetch();
  }

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: "PENDING",  label: "Pendientes" },
    { key: "APPROVED", label: "Aprobadas" },
    { key: "REJECTED", label: "Rechazadas" },
    { key: "ALL",      label: "Todas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Solicitudes de eliminación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprueba o rechaza solicitudes de archivo de productos, proveedores y recetas enviadas por operario (o admin).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 p-1 rounded-lg bg-muted/50 border border-border w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                filter === f.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, solicitante o motivo…"
            className="w-full rounded-md border border-border bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {actionError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          {filter === "PENDING"
            ? "No hay solicitudes pendientes."
            : filter === "ALL"
              ? "No hay solicitudes."
              : `No hay solicitudes ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()}.`}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const Icon = ENTITY_ICONS[r.entity_type] ?? Package;
            const isPending = r.status === "PENDING";
            return (
              <li
                key={r.id}
                className={`rounded-xl border bg-card p-4 shadow-sm ${
                  r.status === "PENDING"   ? "border-amber-200 dark:border-amber-800/40" :
                  r.status === "APPROVED"  ? "border-green-200 dark:border-green-800/40" :
                                             "border-zinc-200 dark:border-zinc-800/40"
                }`}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-[200px] space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {ENTITY_TYPE_LABELS[r.entity_type]}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{r.entity_label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Solicitado por{" "}
                      <span className="font-medium text-foreground">
                        {r.requester_name || r.requester_email || "Desconocido"}
                      </span>
                      {" · "}
                      {new Date(r.requested_at).toLocaleString("es-EC", {
                        dateStyle: "short", timeStyle: "short",
                      })}
                    </p>
                    {r.reason && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-muted/50 border border-border px-2.5 py-1.5 text-xs text-foreground/90">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        <span>{r.reason}</span>
                      </div>
                    )}
                    {r.review_note && (
                      <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground/80">Nota de revisión:</span>
                        <span>{r.review_note}</span>
                      </div>
                    )}
                    {r.reviewed_at && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Revisado el{" "}
                        {new Date(r.reviewed_at).toLocaleString("es-EC", {
                          dateStyle: "short", timeStyle: "short",
                        })}
                      </p>
                    )}
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={reviewing}
                        className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Aprobar
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(r.id);
                          setRejectNote("");
                        }}
                        disabled={reviewing}
                        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Rechazar
                      </button>
                    </div>
                  )}
                </div>

                {rejectingId === r.id && (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                    <label className="text-xs font-medium text-foreground">
                      Motivo de rechazo (opcional)
                    </label>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder="Ej. Producto aún en uso por orden de producción pendiente…"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setRejectingId(null); setRejectNote(""); }}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={reviewing}
                        className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
                      >
                        {reviewing ? "Rechazando..." : "Confirmar rechazo"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
        <Clock className="h-2.5 w-2.5" /> PENDIENTE
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 text-[10px] font-bold">
        <Check className="h-2.5 w-2.5" /> APROBADA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 px-2 py-0.5 text-[10px] font-bold">
      <X className="h-2.5 w-2.5" /> RECHAZADA
    </span>
  );
}
