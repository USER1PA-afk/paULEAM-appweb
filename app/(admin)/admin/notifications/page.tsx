"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  ShoppingCart,
  AlertTriangle,
  Factory,
  Users,
  Package,
  ArrowLeft,
  CheckCheck,
  Trash2,
} from "lucide-react";

type Notification = {
  id: number;
  text: string;
  detail: string;
  time: string;
  date: string;
  read: boolean;
  href: string;
  icon: React.ElementType;
  color: string;
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    text: "Nueva orden de venta recibida",
    detail: "El cliente Juan Pérez realizó un pedido por $45.00",
    time: "Hace 2 min",
    date: "Hoy",
    read: false,
    href: "/admin/orders",
    icon: ShoppingCart,
    color: "text-brand-600 bg-brand-50 dark:bg-brand-900/30",
  },
  {
    id: 2,
    text: "Stock bajo: Harina de trigo",
    detail: "Quedan 3.5 kg — mínimo recomendado: 20 kg",
    time: "Hace 15 min",
    date: "Hoy",
    read: false,
    href: "/admin/inventory",
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
  },
  {
    id: 3,
    text: "Stock bajo: Azúcar refinada",
    detail: "Quedan 2 kg — mínimo recomendado: 15 kg",
    time: "Hace 30 min",
    date: "Hoy",
    read: false,
    href: "/admin/inventory",
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
  },
  {
    id: 4,
    text: "Orden de producción #042 completada",
    detail: "Se produjeron 50 unidades de Pan Artesanal",
    time: "Hace 1 hora",
    date: "Hoy",
    read: true,
    href: "/admin/production",
    icon: Factory,
    color: "text-green-600 bg-green-50 dark:bg-green-900/30",
  },
  {
    id: 5,
    text: "Nuevo empaque completado",
    detail: "Lote EMP-2026-018 — 120 unidades empacadas",
    time: "Hace 3 horas",
    date: "Hoy",
    read: true,
    href: "/admin/packaging",
    icon: Package,
    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
  },
  {
    id: 6,
    text: "Nuevo usuario registrado",
    detail: "María García se registró como cliente",
    time: "Hace 5 horas",
    date: "Hoy",
    read: true,
    href: "/admin/users",
    icon: Users,
    color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30",
  },
  {
    id: 7,
    text: "Nueva orden de venta recibida",
    detail: "El cliente Carlos López realizó un pedido por $28.50",
    time: "10:30 AM",
    date: "Ayer",
    read: true,
    href: "/admin/orders",
    icon: ShoppingCart,
    color: "text-brand-600 bg-brand-50 dark:bg-brand-900/30",
  },
  {
    id: 8,
    text: "Orden de producción #041 completada",
    detail: "Se produjeron 80 unidades de Galletas de Avena",
    time: "08:15 AM",
    date: "Ayer",
    read: true,
    href: "/admin/production",
    icon: Factory,
    color: "text-green-600 bg-green-50 dark:bg-green-900/30",
  },
];

type Filter = "todas" | "no_leidas" | "leidas";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<Filter>("todas");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markRead = (id: number) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

  const deleteNotif = (id: number) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const filtered = notifications.filter((n) => {
    if (filter === "no_leidas") return !n.read;
    if (filter === "leidas") return n.read;
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<Record<string, Notification[]>>((acc, n) => {
    (acc[n.date] ??= []).push(n);
    return acc;
  }, {});

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "todas",     label: "Todas" },
    { key: "no_leidas", label: "No leídas" },
    { key: "leidas",    label: "Leídas" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
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
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-border
              px-3 py-1.5 text-xs font-medium text-muted-foreground
              hover:bg-muted hover:text-foreground transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filters */}
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
            {f.key === "no_leidas" && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] text-white">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {Object.keys(grouped).length === 0 ? (
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
                  const Icon = n.icon;
                  return (
                    <li
                      key={n.id}
                      className={`group relative flex items-start gap-3 rounded-xl border p-3.5
                        transition-all duration-150
                        ${n.read
                          ? "border-border bg-card opacity-70 hover:opacity-100"
                          : "border-brand-200 dark:border-brand-800 bg-card shadow-sm"
                        }`}
                    >
                      {/* Unread dot */}
                      {!n.read && (
                        <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-brand-600" />
                      )}

                      {/* Icon */}
                      <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${n.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content — clickable */}
                      <Link
                        href={n.href}
                        onClick={() => markRead(n.id)}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <p className={`text-sm font-semibold leading-snug
                          ${n.read ? "text-muted-foreground" : "text-foreground"}`}>
                          {n.text}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {n.detail}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {n.time}
                        </p>
                      </Link>

                      {/* Actions */}
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {!n.read && (
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
                          onClick={() => deleteNotif(n.id)}
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
