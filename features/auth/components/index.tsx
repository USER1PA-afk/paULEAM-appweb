"use client";

import { useState } from "react";
import { useAuth } from "@features/auth/hooks";
import { getInsforge } from "@shared/lib/insforge/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, loading, error } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const router = useRouter();
  const insforge = getInsforge();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await signIn(email, password);
    if (result.error) return;

    setRedirecting(true);

    // Obtener el rol del usuario recién autenticado
    try {
      const { data: userData } = await insforge.auth.getCurrentUser();
      const userId = userData?.user?.id;

      let role = "cliente"; // fallback seguro
      if (userId) {
        const { data: profile } = await insforge.database
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        role = (profile as { role: string } | null)?.role ?? "cliente";
      }

      // Persistir el rol en cookie para el proxy
      document.cookie = `pauleam-role=${role}; path=/; max-age=3600; SameSite=Lax`;

      // Redirigir según rol
      if (role === "admin" || role === "operario") {
        router.push("/admin/dashboard");
      } else {
        router.push("/shop/catalog");
      }
    } catch {
      // Si falla la consulta del rol, enviamos a dashboard (el layout se encarga de proteger)
      router.push("/admin/dashboard");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-foreground"
        >
          Correo Electrónico
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@email.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-foreground"
        >
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Ingresa tu contraseña"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || redirecting}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {redirecting ? "Redirigiendo..." : loading ? "Ingresando..." : "Iniciar Sesión"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          href="/register"
          className="font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          Regístrate
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const { signUp, loading, error } = useAuth();
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setSuccess(false);

    if (password.length < 6) {
      setLocalError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Las contraseñas no coinciden");
      return;
    }

    const result = await signUp(email, password, name);
    if (!result.error) {
      // Registro exitoso — el usuario queda autenticado automáticamente.
      // El trigger SQL handle_new_user() crea el perfil con rol 'cliente' por defecto.
      // No hay verificación de email pendiente.
      setSuccess(true);
      // Redirigir a la tienda después de un breve mensaje de éxito
      setTimeout(() => {
        router.push("/shop/catalog");
      }, 1500);
    }
  }

  const displayError = localError || error;

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 ring-4 ring-brand-100">
          <svg
            className="h-8 w-8 text-brand-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            ¡Cuenta creada exitosamente!
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Te estamos redirigiendo al catálogo...
          </p>
        </div>
        <div className="flex justify-center">
          <div className="h-1 w-24 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full animate-pulse rounded-full bg-brand-500" style={{ animation: "grow 1.5s ease-in-out forwards" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="register-name"
          className="block text-sm font-medium text-foreground"
        >
          Nombre Completo
        </label>
        <input
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Juan Pérez"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-email"
          className="block text-sm font-medium text-foreground"
        >
          Correo Electrónico
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@email.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-phone"
          className="block text-sm font-medium text-foreground"
        >
          Teléfono <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <input
          id="register-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+593 9XX XXX XXXX"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-password"
          className="block text-sm font-medium text-foreground"
        >
          Contraseña
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="Mínimo 6 caracteres"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-confirm"
          className="block text-sm font-medium text-foreground"
        >
          Confirmar Contraseña
        </label>
        <input
          id="register-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Repite tu contraseña"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      {displayError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {displayError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Creando cuenta..." : "Crear Cuenta"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Al registrarte aceptas nuestros términos de servicio.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
