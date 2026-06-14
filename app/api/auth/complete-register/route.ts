import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";
import { parseVerifiedEmailCookie } from "../check-pre-verify/route";

/**
 * POST /api/auth/complete-register
 *
 * Creates a new Insforge account ONLY after the email was verified via our
 * own OTP flow. The pauleam-email-verified httpOnly cookie proves the email
 * was confirmed — it is tamper-proof (HMAC-signed) and short-lived (30 min).
 *
 * FLOW:
 *   1. Read + validate pauleam-email-verified cookie.
 *   2. Create account in Insforge (email is already confirmed by us).
 *   3. Immediately sign in to obtain access token.
 *   4. Set pauleam-session + pauleam-role httpOnly cookies.
 *   5. Clear the pauleam-email-verified cookie.
 *
 * Insforge's own "requireEmailVerification" MUST be disabled in the Auth
 * panel — we handle verification ourselves and don't want a second OTP.
 */

export async function POST(req: NextRequest) {
  const verifiedCookie = req.cookies.get("pauleam-email-verified")?.value;
  if (!verifiedCookie) {
    return NextResponse.json({ error: "Email no verificado." }, { status: 401 });
  }

  const verifiedEmail = parseVerifiedEmailCookie(verifiedCookie);
  if (!verifiedEmail) {
    return NextResponse.json({ error: "Verificación expirada. Inicia el registro de nuevo." }, { status: 401 });
  }

  let name: string, password: string, phone: string | undefined;
  try {
    const body = (await req.json()) as { name?: unknown; password?: unknown; phone?: unknown };
    if (typeof body.name !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    name = body.name.trim();
    password = body.password;
    phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  try {
    const insforge = createClient({
      baseUrl:      process.env.NEXT_PUBLIC_INSFORGE_URL,
      anonKey:      process.env.INSFORGE_API_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
      isServerMode: true,
      timeout:      10000,
      retryCount:   1,
    });

    // Create the account — email already verified by our OTP flow
    const { error: signUpErr } = await insforge.auth.signUp({
      email:    verifiedEmail,
      password,
      name,
    });

    if (signUpErr) {
      return NextResponse.json({ error: signUpErr.message }, { status: 400 });
    }

    // Immediately sign in to get a usable access token
    const { data: sessionData, error: signInErr } = await insforge.auth.signInWithPassword({
      email:    verifiedEmail,
      password,
    });

    if (signInErr || !sessionData) {
      return NextResponse.json({ error: "Cuenta creada pero no se pudo iniciar sesión. Intenta desde /login." }, { status: 500 });
    }

    const raw = sessionData as {
      accessToken?: string;
      access_token?: string;
      session?: { access_token?: string };
      user?: { id?: string };
    };
    const token = raw.accessToken ?? raw.access_token ?? raw.session?.access_token;
    const userId = raw.user?.id;

    if (!token) {
      return NextResponse.json({ error: "Token de sesión no disponible." }, { status: 500 });
    }

    // Set full_name + phone on the profile.
    // handle_new_user trigger sets full_name = email as a placeholder;
    // we overwrite it here with the real name the user entered.
    if (userId) {
      const profileUpdate: Record<string, string> = { full_name: name };
      if (phone) profileUpdate.phone = phone;
      await insforge.database
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId)
        .then(() => {}, () => {});
    }

    // Resolve role (should be 'cliente' from handle_new_user trigger)
    const { data: profile } = await insforge.database
      .from("profiles")
      .select("role")
      .eq("id", userId ?? "")
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role ?? "cliente";

    const res = NextResponse.json({ success: true, role });

    // Set Track A session cookies
    const cookieOpts = {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path:     "/",
      maxAge:   60 * 60 * 24 * 7, // 7 days
    };
    res.cookies.set("pauleam-session", token, cookieOpts);
    res.cookies.set("pauleam-role", role, cookieOpts);

    // Clear the email-verified cookie — it's single-use
    res.cookies.set("pauleam-email-verified", "", {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   0,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al crear la cuenta.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
