import { ResetPasswordForm } from "@features/auth/components";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;

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
      <ResetPasswordForm email={email} />
    </div>
  );
}
