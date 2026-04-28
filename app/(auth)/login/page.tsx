import { LoginForm } from "@features/auth/components";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bienvenido de vuelta
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresa tus credenciales para acceder al sistema.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
