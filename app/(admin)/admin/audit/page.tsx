"use client";

import { AuditLogTable, AuditStats } from "@features/audit";
import { useAuditLog } from "@features/audit/hooks";

export default function AdminAuditPage() {
  // Fetch reciente (sin filtros) para las tarjetas de resumen
  const { entries: recentEntries } = useAuditLog({ page: 1, page_size: 200 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoría del Sistema</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Registro inmutable de acciones de usuarios y cambios en datos críticos.
        </p>
      </div>

      <AuditStats entries={recentEntries} />

      <AuditLogTable />
    </div>
  );
}
