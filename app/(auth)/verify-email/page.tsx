import { VerifyEmailForm } from "@features/auth/components";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; mode?: string }>;
}) {
  const { email = "", mode } = await searchParams;
  const isRegister = mode === "register";

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-200 dark:ring-amber-800/40">
          <svg
            className="h-7 w-7 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isRegister ? "Verifica tu correo" : "Confirma tu email"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresa el código de 6 dígitos que enviamos a tu correo.
        </p>
      </div>
      <VerifyEmailForm email={email} mode={isRegister ? "register" : "verify"} />
    </div>
  );
}
