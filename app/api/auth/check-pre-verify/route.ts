import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * POST /api/auth/check-pre-verify
 *
 * Validates the 6-digit pre-registration OTP.
 * On success:
 *   - Deletes the verification record (prevents replay).
 *   - Sets a short-lived HMAC-signed httpOnly cookie `pauleam-email-verified`
 *     that /api/auth/complete-register reads to know which email was confirmed.
 *
 * SECURITY:
 *   - Max 5 attempts per OTP before the record is deleted.
 *   - OTP is compared as SHA-256 hash (no plaintext stored or logged).
 *   - Cookie is HMAC-signed with AUTH_COOKIE_SECRET — tampering returns 401.
 *   - Cookie is httpOnly + SameSite=Lax — not readable by JS.
 *   - Cookie expires in 30 minutes.
 */

const COOKIE_NAME = "pauleam-email-verified";
const MAX_ATTEMPTS = 5;

function getSecret(): string {
  const s = process.env.AUTH_COOKIE_SECRET;
  if (!s) throw new Error("AUTH_COOKIE_SECRET is not set");
  return s;
}

export function signVerifiedEmail(email: string): string {
  const ts = Date.now().toString();
  const payload = `${email}|${ts}`;
  const hmac = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}|${hmac}`).toString("base64url");
}

export function parseVerifiedEmailCookie(cookie: string): string | null {
  try {
    const decoded = Buffer.from(cookie, "base64url").toString("utf8");
    const lastPipe = decoded.lastIndexOf("|");
    const secondLastPipe = decoded.lastIndexOf("|", lastPipe - 1);
    if (lastPipe === -1 || secondLastPipe === -1) return null;

    const email = decoded.slice(0, secondLastPipe);
    const ts = decoded.slice(secondLastPipe + 1, lastPipe);
    const hmac = decoded.slice(lastPipe + 1);

    const payload = `${email}|${ts}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");

    const hmacBuf = Buffer.from(hmac, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (hmacBuf.length !== expBuf.length || !timingSafeEqual(hmacBuf, expBuf)) return null;
    if (Date.now() - parseInt(ts, 10) > 30 * 60 * 1000) return null;

    return email;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let email: string, otp: string;
  try {
    const body = (await req.json()) as { email?: unknown; otp?: unknown };
    if (typeof body.email !== "string" || typeof body.otp !== "string") {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    email = body.email.trim().toLowerCase();
    otp = body.otp.replace(/\D/g, "");
    if (otp.length !== 6) {
      return NextResponse.json({ error: "Código inválido." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  try {
    const insforge = createClient({
      baseUrl:    process.env.NEXT_PUBLIC_INSFORGE_URL,
      anonKey:    process.env.INSFORGE_API_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
      timeout:    8000,
      retryCount: 0,
    });

    const { data: record } = await insforge.database
      .from("email_verifications")
      .select("otp_hash, expires_at, attempts")
      .eq("email", email)
      .maybeSingle();

    if (!record) {
      return NextResponse.json({ error: "Código no encontrado o expirado." }, { status: 400 });
    }

    const rec = record as { otp_hash: string; expires_at: string; attempts: number };

    if (new Date(rec.expires_at) < new Date()) {
      await insforge.database.from("email_verifications").delete().eq("email", email);
      return NextResponse.json({ error: "El código ha expirado. Solicita uno nuevo." }, { status: 400 });
    }

    if (rec.attempts >= MAX_ATTEMPTS) {
      await insforge.database.from("email_verifications").delete().eq("email", email);
      return NextResponse.json({ error: "Demasiados intentos fallidos. Solicita un nuevo código." }, { status: 400 });
    }

    const submittedHash = createHash("sha256").update(otp).digest("hex");
    const storedBuf = Buffer.from(rec.otp_hash, "hex");
    const submittedBuf = Buffer.from(submittedHash, "hex");

    const match =
      storedBuf.length === submittedBuf.length &&
      timingSafeEqual(storedBuf, submittedBuf);

    if (!match) {
      await insforge.database
        .from("email_verifications")
        .update({ attempts: rec.attempts + 1 })
        .eq("email", email);
      const remaining = MAX_ATTEMPTS - rec.attempts - 1;
      return NextResponse.json(
        { error: `Código incorrecto. Te quedan ${remaining} intento${remaining !== 1 ? "s" : ""}.` },
        { status: 400 }
      );
    }

    // Valid — delete the record to prevent replay
    await insforge.database.from("email_verifications").delete().eq("email", email);

    const cookieValue = signVerifiedEmail(email);
    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60, // 30 minutes
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Error interno. Intenta de nuevo." }, { status: 500 });
  }
}
