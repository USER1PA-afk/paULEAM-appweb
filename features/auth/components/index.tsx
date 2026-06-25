"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@features/auth/hooks";
import { getInsforge } from "@shared/lib/insforge/client";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export { GoogleSignInButton } from "./google-sign-in-button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, loading, error } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
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

      // Yield to the browser's cookie-commit microtask queue before navigating.
      // Mobile browsers (Chrome Android) may not flush Set-Cookie to the
      // cookie jar synchronously — a 100ms gap prevents the race condition
      // where the proxy fires before the httpOnly session cookie is readable.
      await new Promise((r) => setTimeout(r, 100));

      // Hard navigation so the browser sends a fresh request carrying
      // the pauleam-session httpOnly cookie the proxy depends on.
      if (role === "sales_kiosk") {
        window.location.href = "/pos";
      } else if (role === "admin" || role === "operario") {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/shop/catalog";
      }
    } catch {
      // Si falla la consulta del rol, enviamos a dashboard (el layout se encarga de proteger)
      await new Promise((r) => setTimeout(r, 100));
      window.location.href = "/admin/dashboard";
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
          autoComplete="email"
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
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Ingresa tu contraseña"
            className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword
              ? <EyeOff aria-hidden="true" className="h-4 w-4" />
              : <Eye aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
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

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
            Regístrate
          </Link>
        </p>
        <Link href="/forgot-password" className="font-medium text-muted-foreground hover:text-foreground transition-colors">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </form>
  );
}

// ─── Step 1 of registration: collect email, send pre-verification OTP ─────────
// Nothing is written to Insforge until the OTP is confirmed.

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch("/api/auth/send-pre-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const body = (await res.json()) as { signature?: string; error?: string };

      if (res.status === 409) {
        throw new Error(body.error ?? "Ya existe una cuenta con este correo.");
      }
      if (!res.ok) throw new Error(body.error ?? "Error al enviar el código.");
      if (!body.signature) throw new Error("Error al enviar el código. Intenta de nuevo.");

      window.location.href = `/verify-email?email=${encodeURIComponent(cleanEmail)}&mode=register&sig=${encodeURIComponent(body.signature)}`;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar el código. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="register-email" className="block text-sm font-medium text-foreground">
          Correo Electrónico
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@email.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
        <p className="text-xs text-muted-foreground">
          Primero verificamos que el correo sea tuyo.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Enviando código…" : "Continuar con verificación"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700 transition-colors">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

// ─── Step 3 of registration: name, password, phone (after OTP verified) ───────

export function CompleteRegisterForm({ email }: { email: string }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordChecks = [
    { label: "8+ caracteres",  ok: password.length >= 8 },
    { label: "Mayúscula (A-Z)", ok: /[A-Z]/.test(password) },
    { label: "Minúscula (a-z)", ok: /[a-z]/.test(password) },
    { label: "Número (0-9)",   ok: /\d/.test(password) },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordChecks.every((c) => c.ok)) {
      setError("La contraseña no cumple los requisitos.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password, phone: phone.trim() || undefined }),
      });
      const body = (await res.json()) as { error?: string; role?: string };
      if (!res.ok) throw new Error(body.error ?? "Error al crear la cuenta.");

      setSuccess(true);
      await new Promise((r) => setTimeout(r, 100)); // let cookie flush
      window.location.href = "/shop/catalog";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 ring-4 ring-emerald-100 dark:ring-emerald-800/40">
          <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">¡Cuenta creada!</p>
          <p className="text-sm text-muted-foreground mt-1">Accediendo al catálogo…</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Verified email badge */}
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
        <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm text-emerald-800 dark:text-emerald-300 font-medium truncate">{email}</span>
        <span className="text-xs text-emerald-600 dark:text-emerald-500 shrink-0">verificado</span>
      </div>

      <div className="space-y-2">
        <label htmlFor="cr-name" className="block text-sm font-medium text-foreground">Nombre Completo</label>
        <input
          id="cr-name" type="text" autoComplete="name" value={name}
          onChange={(e) => setName(e.target.value)} required placeholder="Juan Pérez"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="cr-phone" className="block text-sm font-medium text-foreground">Teléfono</label>
        <input
          id="cr-phone" type="tel" autoComplete="tel" value={phone}
          onChange={(e) => setPhone(e.target.value)} required placeholder="+593 9XX XXX XXXX"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="cr-password" className="block text-sm font-medium text-foreground">Contraseña</label>
        <div className="relative">
          <input
            id="cr-password" type={showPassword ? "text" : "password"}
            autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={8}
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
          <button type="button" onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar" : "Mostrar"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {passwordChecks.map(({ label, ok }) => (
            <div key={label} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              ok ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60"
                 : "bg-muted text-muted-foreground ring-1 ring-border"}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="cr-confirm" className="block text-sm font-medium text-foreground">Confirmar Contraseña</label>
        <input
          id="cr-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password"
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          required placeholder="Repite tu contraseña"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? "Creando cuenta…" : "Crear Cuenta"}
      </button>

      <p className="text-center text-xs text-muted-foreground">Al registrarte aceptas nuestros términos de servicio.</p>
    </form>
  );
}

// ─── OTP Input Component ──────────────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  error,
  success,
  disabled,
}: {
  value: string[];
  onChange: (otp: string[]) => void;
  error: boolean;
  success: boolean;
  disabled: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      if (value[index]) {
        const next = [...value];
        next[index] = "";
        onChange(next);
      } else if (index > 0) {
        const next = [...value];
        next[index - 1] = "";
        onChange(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    const next = Array(6).fill("");
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    onChange(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  return (
    <>
      <style>{`
        @keyframes otp-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes otp-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .otp-shake { animation: otp-shake 0.45s ease-in-out; }
        .otp-pop { animation: otp-pop 0.18s ease-out; }
      `}</style>
      <div
        className={`flex gap-2 justify-center ${error ? "otp-shake" : ""}`}
        role="group"
        aria-label="Código de verificación de 6 dígitos"
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const filled = !!value[i];
          return (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={value[i]}
              disabled={disabled}
              aria-label={`Dígito ${i + 1}`}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              className={[
                "w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-200 select-none",
                "focus:ring-0",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-text",
                success
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : error
                  ? "border-destructive bg-destructive/5 text-destructive"
                  : filled
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-200 shadow-md shadow-amber-200/60 dark:shadow-amber-900/30 otp-pop"
                  : "border-border bg-background text-foreground focus:border-brand-500 focus:shadow-md focus:shadow-brand-500/15",
              ].join(" ")}
            />
          );
        })}
      </div>
    </>
  );
}

// ─── Verify Email Form ────────────────────────────────────────────────────────

export function VerifyEmailForm({ email, mode = "verify", signature: initialSig }: { email: string; mode?: "register" | "verify"; signature?: string }) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [signature, setSignature] = useState(initialSig ?? "");
  const insforge = getInsforge();

  const otpStr = otp.join("");
  const isComplete = otpStr.length === 6 && otp.every(Boolean);
  const isShaking = !!error;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        // Pre-registration OTP: validate against email_verifications table
        const res = await fetch("/api/auth/check-pre-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp: otpStr }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Código incorrecto.");
        setSuccess(true);
        await new Promise((r) => setTimeout(r, 900));
        window.location.href = `/complete-register`;
      } else {
        // Post-signup Insforge OTP (if requireEmailVerification is on)
        const { data, error: verifyErr } = await insforge.auth.verifyEmail({ email, otp: otpStr });
        if (verifyErr) throw verifyErr;
        const token = (data as { accessToken?: string } | null)?.accessToken;
        if (token) {
          const res = await fetch("/api/auth/set-cookie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }).catch(() => null);
          if (!res?.ok) throw new Error("No se pudo establecer la sesión.");
        }
        setSuccess(true);
        await new Promise((r) => setTimeout(r, 1400));
        window.location.href = "/shop/catalog";
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Código incorrecto. Intenta de nuevo.";
      setError(msg);
      setTimeout(() => {
        setError(null);
        setOtp(Array(6).fill(""));
      }, 800);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/send-pre-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const body = (await res.json()) as { signature?: string };
        const newSig = body.signature ?? "";
        setSignature(newSig);
        const url = new URL(window.location.href);
        url.searchParams.set("sig", newSig);
        window.history.replaceState(null, "", url.toString());
      } else {
        await insforge.auth.resendVerificationEmail({ email });
      }
      setCooldown(60);
    } catch {
      // silent
    } finally {
      setResending(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 ring-4 ring-emerald-200 dark:ring-emerald-800/50">
          <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">¡Email verificado!</p>
          <p className="text-sm text-muted-foreground mt-1">Accediendo a tu cuenta…</p>
        </div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900">
          <div className="h-full rounded-full bg-emerald-500" style={{ animation: "grow 1.4s ease-in-out forwards" }} />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email badge */}
      <div className="flex items-center justify-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-sm text-muted-foreground w-fit mx-auto">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="font-medium text-foreground truncate max-w-[200px]">{email}</span>
      </div>

      {/* OTP Inputs */}
      <OtpInput
        value={otp}
        onChange={setOtp}
        error={isShaking}
        success={success}
        disabled={loading}
      />

      {/* Error message */}
      {error && (
        <p role="alert" className="text-center text-sm text-destructive font-medium">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!isComplete || loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verificando…
          </span>
        ) : "Verificar email"}
      </button>

      {/* Resend */}
      <p className="text-center text-sm text-muted-foreground">
        ¿No recibiste el código?{" "}
        {cooldown > 0 ? (
          <span className="font-medium tabular-nums">Reenviar en {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50"
          >
            {resending ? "Enviando…" : "Reenviar código"}
          </button>
        )}
      </p>

      {/* Spam note */}
      <p className="text-center text-xs text-muted-foreground/70">
        ¿No encuentras el correo? Revisa tu carpeta de{" "}
        <strong className="text-muted-foreground">spam</strong> o{" "}
        <strong className="text-muted-foreground">correo no deseado</strong>.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}

// ─── Forgot Password Form ─────────────────────────────────────────────────────

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = (await res.json()) as { signature?: string; error?: string; message?: string };

      if (res.status === 404) {
        throw new Error(body.error ?? "No existe una cuenta con este correo.");
      }
      if (!res.ok) throw new Error(body.error ?? "Error al enviar el código.");

      setSignature(body.signature ?? "");
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar el código.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-4 text-center py-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/40 ring-4 ring-brand-100 dark:ring-brand-800/30">
            <svg className="h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Revisa tu correo</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Si existe una cuenta con ese correo, recibirás un código de 6 dígitos en breve.
            </p>
          </div>
        </div>
        <Link
          href={`/reset-password?email=${encodeURIComponent(email)}&sig=${encodeURIComponent(signature)}`}
          className="block w-full rounded-md bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Ingresar código →
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-muted-foreground hover:text-foreground transition-colors">
            ← Volver al inicio de sesión
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="forgot-email" className="block text-sm font-medium text-foreground">
          Correo Electrónico
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@email.com"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Enviando…" : "Enviar código de recuperación"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}

// ─── Reset Password Form ──────────────────────────────────────────────────────

export function ResetPasswordForm({ email, signature }: { email: string; signature?: string }) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const insforge = getInsforge();

  const otpStr = otp.join("");
  const isOtpComplete = otpStr.length === 6 && otp.every(Boolean);

  const passwordChecks = [
    { label: "8+ caracteres", ok: newPassword.length >= 8 },
    { label: "Mayúscula (A-Z)", ok: /[A-Z]/.test(newPassword) },
    { label: "Minúscula (a-z)", ok: /[a-z]/.test(newPassword) },
    { label: "Número (0-9)", ok: /\d/.test(newPassword) },
  ];
  const passwordValid = passwordChecks.every((c) => c.ok);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setError(null);

    if (!isOtpComplete) {
      setLocalError("Ingresa el código de 6 dígitos.");
      return;
    }
    if (!passwordValid) {
      setLocalError("La contraseña no cumple los requisitos.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      // Step 1: exchange code for reset token
      const { data: tokenData, error: exchangeErr } = await insforge.auth.exchangeResetPasswordToken({
        email,
        code: otpStr,
      });
      if (exchangeErr) {
        setOtpError(true);
        setTimeout(() => { setOtpError(false); setOtp(Array(6).fill("")); }, 800);
        throw exchangeErr;
      }

      // Step 2: reset password with the token
      const resetToken = (tokenData as { token?: string } | null)?.token;
      if (!resetToken) throw new Error("Token de restablecimiento no disponible.");

      const { error: resetErr } = await insforge.auth.resetPassword({
        newPassword,
        otp: resetToken,
      });
      if (resetErr) throw resetErr;

      setSuccess(true);
      await new Promise((r) => setTimeout(r, 2000));
      window.location.href = "/login";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 ring-4 ring-emerald-200 dark:ring-emerald-800/50">
          <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">¡Contraseña actualizada!</p>
          <p className="text-sm text-muted-foreground mt-1">Redirigiendo al inicio de sesión…</p>
        </div>
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email badge */}
      <div className="flex items-center justify-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-sm text-muted-foreground w-fit mx-auto">
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="font-medium text-foreground truncate max-w-[200px]">{email}</span>
      </div>

      {/* Code */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground text-center">
          Código de recuperación
        </label>
        <OtpInput
          value={otp}
          onChange={setOtp}
          error={otpError}
          success={false}
          disabled={loading}
        />
      </div>

      {/* New password */}
      <div className="space-y-2">
        <label htmlFor="reset-password" className="block text-sm font-medium text-foreground">
          Nueva contraseña
        </label>
        <div className="relative">
          <input
            id="reset-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {passwordChecks.map(({ label, ok }) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                ok
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60"
                  : "bg-muted text-muted-foreground ring-1 ring-border"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Confirm */}
      <div className="space-y-2">
        <label htmlFor="reset-confirm" className="block text-sm font-medium text-foreground">
          Confirmar contraseña
        </label>
        <input
          id="reset-confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Repite la nueva contraseña"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>

      {displayError && (
        <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {displayError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Actualizando…" : "Restablecer contraseña"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
