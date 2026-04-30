"use client";

import { getInsforge } from "@shared/lib/insforge/client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  profile: {
    name?: string;
    avatar_url?: string;
  };
  metadata: Record<string, unknown>;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook principal de autenticación.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const insforge = getInsforge();
  const router = useRouter();

  // Verificar sesión al montar
  useEffect(() => {
    async function checkSession() {
      try {
        const { data, error } = await insforge.auth.getCurrentUser();
        if (error || !data?.user) {
          setState({ user: null, loading: false, error: null });
          return;
        }
        setState({
          user: data.user as unknown as AuthUser,
          loading: false,
          error: null,
        });
      } catch {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
    checkSession();
  }, [insforge]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data, error } = await insforge.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setState({
          user: data?.user as unknown as AuthUser ?? null,
          loading: false,
          error: null,
        });
        return { data, error: null };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error de autenticación";
        setState((prev) => ({ ...prev, loading: false, error: message }));
        return { data: null, error: message };
      }
    },
    [insforge]
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { data, error } = await insforge.auth.signUp({
          email,
          password,
          name,
        });
        if (error) throw error;

        // Forzar login inmediato para obtener el token real del SDK
        const loginRes = await insforge.auth.signInWithPassword({
          email,
          password,
        });
        
        if (loginRes.error) throw loginRes.error;

        // El trigger handle_new_user() crea el perfil con rol 'cliente' por defecto
        setState({
          user: loginRes.data?.user as unknown as AuthUser ?? null,
          loading: false,
          error: null,
        });
        return { data: loginRes.data, error: null };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Error al registrarse";
        setState((prev) => ({ ...prev, loading: false, error: message }));
        return { data: null, error: message };
      }
    },
    [insforge]
  );

  const signOut = useCallback(async () => {
    try {
      await insforge.auth.signOut();
    } catch (err) {
      console.warn("Logout warning:", err);
    } finally {
      setState({ user: null, loading: false, error: null });
      // Limpiar cookie de rol y posibles cookies del SDK
      document.cookie = 'pauleam-role=; path=/; max-age=0; SameSite=Lax';
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        if (name.includes("-auth-token") || name.includes("access_token")) {
          document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
        }
      });
      // Limpiar localStorage
      if (typeof window !== "undefined") {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes("-auth-token") || key.includes("access_token"))) {
            localStorage.removeItem(key);
          }
        }
      }
      // Redirigir al index principal tras cerrar sesión
      router.push("/");
    }
  }, [insforge, router]);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!state.user,
  };
}

/**
 * Hook para obtener el rol del usuario actual.
 */
export function useRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const insforge = getInsforge();

  useEffect(() => {
    async function fetchRole() {
      try {
        const { data: userData } = await insforge.auth.getCurrentUser();
        if (!userData?.user?.id) {
          setLoading(false);
          return;
        }
        const { data } = await insforge.database
          .from("profiles")
          .select("role")
          .eq("id", userData.user.id)
          .single();

        setRole((data as { role: string } | null)?.role ?? null);
      } catch {
        setRole(null);
      } finally {
        setLoading(false);
      }
    }
    fetchRole();
  }, [insforge]);

  return {
    role,
    loading,
    isAdmin: role === "admin",
    isOperario: role === "operario",
    isCliente: role === "cliente",
    isStaff: role === "admin" || role === "operario",
  };
}
