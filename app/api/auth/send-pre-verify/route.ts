import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { randomInt, createHash } from "crypto";

/**
 * POST /api/auth/send-pre-verify
 *
 * Sends a 6-digit OTP to an email address BEFORE creating any account.
 * Nothing is written to Insforge's auth system at this point.
 *
 * SECURITY:
 *   - Returns HTTP 200 with the same body for all outcomes (no enumeration).
 *   - If the email is already registered, does NOT send an OTP
 *     (avoids wasting sends and leaking registration status).
 *   - Minimum 900ms response time prevents timing side-channels.
 *   - OTP is stored as SHA-256 hash — plaintext is never persisted.
 *   - Upserts: a second request for the same email resets the OTP and timer.
 */

const MIN_MS = 900;
const GENERIC = { message: "Revisa tu correo. ¿No lo ves? Busca en spam o correo no deseado." };

function buildOtpEmail(otp: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Código de verificación — PAuleam</title></head>
<body style="margin:0;padding:40px 0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#2563eb;padding:28px 40px;">
      <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">PAuleam</p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:12px;">Planta de Alimentos · ULEAM</p>
    </div>
    <div style="padding:40px;">
      <p style="margin:0 0 8px;color:#111827;font-size:16px;font-weight:600;">Tu código de verificación</p>
      <p style="margin:0 0 28px;color:#6b7280;font-size:14px;">Ingresa este código para confirmar tu dirección de correo.</p>
      <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
        <span style="font-size:44px;font-weight:800;letter-spacing:14px;color:#d97706;font-family:'Courier New',monospace;">${otp}</span>
      </div>
      <p style="margin:0 0 6px;color:#6b7280;font-size:13px;">Expira en <strong>15 minutos</strong>. Solo puedes intentarlo <strong>5 veces</strong>.</p>
      <p style="margin:0 0 28px;color:#6b7280;font-size:13px;">Si no solicitaste este código, ignora este mensaje.</p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        ¿No encuentras el correo? Revisa tu carpeta de <strong>spam</strong> o <strong>correo no deseado</strong>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  const start = Date.now();

  async function settle() {
    const elapsed = Date.now() - start;
    if (elapsed < MIN_MS) await new Promise((r) => setTimeout(r, MIN_MS - elapsed));
  }

  let email: string;
  try {
    const body = (await req.json()) as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      await settle(); return NextResponse.json(GENERIC);
    }
    email = body.email.trim().toLowerCase();
  } catch {
    await settle(); return NextResponse.json(GENERIC);
  }

  try {
    const insforge = createClient({
      baseUrl:    process.env.NEXT_PUBLIC_INSFORGE_URL,
      anonKey:    process.env.INSFORGE_API_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
      timeout:    8000,
      retryCount: 0,
    });

    // If email already registered, silently skip — same response either way.
    const { data: existing } = await insforge.database
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing !== null) {
      await settle();
      return NextResponse.json(GENERIC);
    }

    const otp = String(randomInt(100000, 1000000));
    const otpHash = createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await insforge.database
      .from("email_verifications")
      .upsert(
        { email, otp_hash: otpHash, expires_at: expiresAt, attempts: 0 },
        { onConflict: "email" }
      );

    await insforge.emails.send({
      to: email,
      subject: "Código de verificación — PAuleam",
      html: buildOtpEmail(otp),
    });
  } catch {
    // swallow — never expose internal state
  }

  await settle();
  return NextResponse.json(GENERIC);
}
