import { z } from "zod";

// ============================
// Enums
// ============================

export const AuditActionEnum = z.enum([
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "INSERT",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
  "ROLE_CHANGE",
  "ACTIVATION_CHANGE",
  "POS_SALE",
]);
export type AuditAction = z.infer<typeof AuditActionEnum>;

export const AuditEntityTypeEnum = z.enum([
  "auth_session",
  "products",
  "recipes",
  "production_orders",
  "packaging_orders",
  "orders",
  "profiles",
]);
export type AuditEntityType = z.infer<typeof AuditEntityTypeEnum>;

// ============================
// Labels para la UI
// ============================

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN:             "Inicio de sesión",
  LOGOUT:            "Cierre de sesión",
  LOGIN_FAILED:      "Login fallido",
  INSERT:            "Creación",
  UPDATE:            "Actualización",
  DELETE:            "Eliminación",
  STATUS_CHANGE:     "Cambio de estado",
  ROLE_CHANGE:       "Cambio de rol",
  ACTIVATION_CHANGE: "Cambio de activación",
  POS_SALE:          "Venta POS",
};

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  auth_session:      "Sesión",
  products:          "Producto",
  recipes:           "Receta",
  production_orders: "Orden de Producción",
  packaging_orders:  "Orden de Empaque",
  orders:            "Orden de Venta",
  profiles:          "Perfil de Usuario",
};

// Colores para badges — mismo patrón que STATUS_CONFIG en orders/page.tsx
export const AUDIT_ACTION_COLORS: Record<AuditAction, { dot: string; bg: string; text: string }> = {
  LOGIN:             { dot: "bg-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300" },
  LOGOUT:            { dot: "bg-zinc-400",    bg: "bg-zinc-100 dark:bg-zinc-800/40",       text: "text-zinc-600 dark:text-zinc-400"      },
  LOGIN_FAILED:      { dot: "bg-rose-500",    bg: "bg-rose-100 dark:bg-rose-900/20",       text: "text-rose-700 dark:text-rose-300"      },
  INSERT:            { dot: "bg-blue-500",    bg: "bg-blue-100 dark:bg-blue-900/20",       text: "text-blue-700 dark:text-blue-300"      },
  UPDATE:            { dot: "bg-amber-500",   bg: "bg-amber-100 dark:bg-amber-900/20",     text: "text-amber-700 dark:text-amber-300"    },
  DELETE:            { dot: "bg-rose-600",    bg: "bg-rose-100 dark:bg-rose-900/20",       text: "text-rose-700 dark:text-rose-300"      },
  STATUS_CHANGE:     { dot: "bg-violet-500",  bg: "bg-violet-100 dark:bg-violet-900/20",   text: "text-violet-700 dark:text-violet-300"  },
  ROLE_CHANGE:       { dot: "bg-brand-600",   bg: "bg-brand-100 dark:bg-brand-900/20",     text: "text-brand-700 dark:text-brand-300"    },
  ACTIVATION_CHANGE: { dot: "bg-teal-500",    bg: "bg-teal-100 dark:bg-teal-900/20",       text: "text-teal-700 dark:text-teal-300"      },
  POS_SALE:          { dot: "bg-indigo-500",  bg: "bg-indigo-100 dark:bg-indigo-900/20",   text: "text-indigo-700 dark:text-indigo-300"  },
};

// ============================
// Schema Zod (read side — permissive)
// ============================
// The audit_log.entity_type and audit_log.action columns are plain TEXT
// in the DB (no CHECK constraints), and created_at is TIMESTAMPTZ which
// PostgREST may serialize as `Z`, `+00:00`, or without millisecond
// precision. Strict z.enum / z.string().datetime() would drop perfectly
// valid historical rows when a new action/entity is introduced or when
// the wire format shifts. The read schema is intentionally permissive:
// any non-empty string is accepted for action / entity_type, and any
// string Date.parse() understands is accepted for created_at. The
// strict enums above remain the source of truth for *write* paths
// (useAuditActions, filter UI).

export const AuditLogSchema = z.object({
  id:          z.string().uuid(),
  user_id:     z.string().uuid().nullable(),
  user_name:   z.string(),
  action:      z.string().min(1),
  entity_type: z.string().min(1),
  entity_id:   z.string().uuid().nullable(),
  old_values:  z.record(z.string(), z.unknown()).nullable(),
  new_values:  z.record(z.string(), z.unknown()).nullable(),
  details:     z.string().nullable(),
  created_at:  z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date"),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ============================
// Filtros para el hook
// ============================

export interface AuditFilters {
  action?:      AuditAction | "";
  entity_type?: AuditEntityType | "";
  date_from?:   string;
  date_to?:     string;
  page?:        number;
  page_size?:   number;
}
