"use client";

import { useState, useEffect } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { useRequestDeletion } from "../hooks";
import { ENTITY_TYPE_LABELS, DeletionEntityType } from "@entities/deletion-request";

interface RequestDeletionDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  entityType: DeletionEntityType;
  entityId: string;
  entityLabel: string;
}

/**
 * Modal shown to operario (and admin) when they want to remove a
 * product/supplier/recipe. Submits a deletion_request via RPC; the
 * actual soft-delete happens only when an admin approves it.
 */
export function RequestDeletionDialog({
  open,
  onClose,
  onSubmitted,
  entityType,
  entityId,
  entityLabel,
}: RequestDeletionDialogProps) {
  const { requestDeletion, loading, error } = useRequestDeletion();
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason("");
      setSuccess(false);
    }
  }, [open, entityId]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error: err } = await requestDeletion(entityType, entityId, reason || undefined);
    if (err) return;
    setSuccess(true);
    onSubmitted();
    setTimeout(() => onClose(), 1200);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Solicitar eliminación"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl animate-modal-panel">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">
              Solicitar eliminación de {ENTITY_TYPE_LABELS[entityType].toLowerCase()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="px-5 py-8 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">Solicitud enviada</p>
            <p className="text-xs text-muted-foreground">
              Un administrador revisará y aprobará o rechazará la solicitud.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-0.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {ENTITY_TYPE_LABELS[entityType]}
              </p>
              <p className="text-sm font-semibold text-foreground truncate">{entityLabel}</p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="deletion-reason"
                className="text-xs font-medium text-muted-foreground"
              >
                Motivo (opcional)
              </label>
              <textarea
                id="deletion-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Ej. Proveedor dejó de operar / receta descontinuada / producto sustituido por…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
              El {ENTITY_TYPE_LABELS[entityType].toLowerCase()} no se eliminará ahora — se enviará
              una solicitud a un administrador. Si es aprobada, quedará archivado (no se mostrará en
              formularios ni catálogo) y podrá ser restaurado.
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-md border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
