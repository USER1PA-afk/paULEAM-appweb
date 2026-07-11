import { ResetPasswordForm } from "@features/auth/components";
import { verifyEmailUrlSignature } from "@features/auth/lib";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; sig?: string }>;
}) {
  const { email = "", sig = "" } = await searchParams;

  if (!email || !sig || !verifyEmailUrlSignature(email, sig)) {
    return (
      <div className="space-y-6 text-center py-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/20">
          <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Enlace inválido</h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Este enlace de recuperación no es válido o ha expirado. Solicita un nuevo código desde &quot;¿Olvidaste tu contraseña?&quot;
        </p>
        <a
          href="/forgot-password"
          className="inline-block rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Recuperar contraseña
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Nueva contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresa el código que recibiste y elige tu nueva contraseña.
        </p>
      </div>
      <ResetPasswordForm email={email} signature={sig} />
    </div>
  );
}
