"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "REQUEST" | "ALERT";
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await insforge.database
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      setNotifications((data as Notification[]) ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [insforge]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = useCallback(
    async (id: string) => {
      const { error } = await insforge.database
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (!error) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      }
      return { error: error ? (error instanceof Error ? error.message : String(error)) : null };
    },
    [insforge]
  );

  const markAllRead = useCallback(async () => {
    const { data: userData } = await insforge.auth.getCurrentUser();
    if (!userData?.user?.id) return { error: "No autenticado" };

    const { error } = await insforge.database
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userData.user.id)
      .eq("is_read", false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
    return { error: error ? (error instanceof Error ? error.message : String(error)) : null };
  }, [insforge]);

  const deleteNotification = useCallback(
    async (id: string) => {
      const { error } = await insforge.database
        .from("notifications")
        .delete()
        .eq("id", id);

      if (!error) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
      return { error: error ? (error instanceof Error ? error.message : String(error)) : null };
    },
    [insforge]
  );

  return {
    notifications,
    loading,
    unreadCount: notifications.filter((n) => !n.is_read).length,
    refetch: fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
  };
}
