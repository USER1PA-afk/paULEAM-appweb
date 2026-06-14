import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { parseVerifiedEmailCookie } from "@/app/api/auth/check-pre-verify/route";
import { CompleteRegisterForm } from "@features/auth/components";

export default async function CompleteRegisterPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("pauleam-email-verified")?.value;
  const email = raw ? parseVerifiedEmailCookie(raw) : null;

  if (!email) {
    redirect("/register");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Completa tu registro
        </h1>
        <p className="text-sm text-muted-foreground">
          Tu correo está verificado. Ahora elige tu nombre y contraseña.
        </p>
      </div>
      <CompleteRegisterForm email={email} />
    </div>
  );
}
