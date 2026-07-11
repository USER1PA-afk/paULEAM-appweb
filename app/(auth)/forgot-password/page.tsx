import { ForgotPasswordForm } from "@features/auth/components";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Recupera tu contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Escribe tu correo y te enviaremos un código para restablecer tu contraseña.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
