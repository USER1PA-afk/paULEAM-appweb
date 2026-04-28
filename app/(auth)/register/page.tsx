import { RegisterForm } from "@features/auth/components";

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Crear cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Regístrate para realizar pedidos en nuestra tienda.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
