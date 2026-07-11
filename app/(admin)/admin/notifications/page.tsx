"use client";

import Link from "next/link";
import { useState } from "react";
import { useNotifications } from "@features/notifications/hooks";
import {
  Bell,
  ArrowLeft,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Factory,
  ShoppingCart,
} from "lucide-react";

type Filter = "todas" | "no_leidas" | "leidas";

const ICONS: Record<string, React.ElementType> = {
  REQUEST: Factory,
  ALERT: AlertTriangle,
};

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead, deleteNotification } = useNotifications();
  const [filter, setFilter] = useState<Filter>("todas");

  const filtered = notifications.filter((n) => {
    if (filter === "no_leidas") return !n.is_read;
    if (filter === "leidas") return n.is_read;
    return true;
  });

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, n) => {
    const date = new Date(n.created_at).toLocaleDateString("es-EC", { dateStyle: "long" });
    (acc[date] ??= []).push(n);
    return acc;
  }, {});

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "no_leidas", label: "No leídas" },
    { key: "leidas", label: "Leídas" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-md
            text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Volver al dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-600" />
            Notificaciones
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {unreadCount} nuevas
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {notifications.length} notificaciones en total
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="flex items-center gap-1.5 rounded-lg border border-border
              px-3 py-1.5 text-xs font-medium text-muted-foreground
              hover:bg-muted hover:text-foreground transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="flex gap-1.5 p-1 rounded-lg bg-muted/50 border border-border w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150
              ${filter === f.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No hay notificaciones</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {date}
              </p>
              <ul className="space-y-2">
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? ShoppingCart;
                  return (
                    <li
                      key={n.id}
                      className={`group relative flex items-start gap-3 rounded-xl border p-3.5
                        transition-all duration-150
                        ${n.is_read
                          ? "border-border bg-card opacity-70 hover:opacity-100"
                          : "border-brand-200 dark:border-brand-800 bg-card shadow-sm"
                        }`}
                    >
                      {!n.is_read && (
                        <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-brand-600" />
                      )}

                      <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug
                          ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(n.created_at).toLocaleTimeString("es-EC", { timeStyle: "short" })}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {!n.is_read && (
                          <button
                            onClick={() => markRead(n.id)}
                            title="Marcar como leída"
                            className="flex h-7 w-7 items-center justify-center rounded-md
                              text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(n.id)}
                          title="Eliminar"
                          className="flex h-7 w-7 items-center justify-center rounded-md
                            text-muted-foreground hover:bg-red-50 hover:text-red-600
                            dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
