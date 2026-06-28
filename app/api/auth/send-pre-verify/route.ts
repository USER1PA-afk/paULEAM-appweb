import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { randomInt, createHash } from "crypto";
import { signEmailUrl } from "@features/auth/lib";

/**
 * POST /api/auth/send-pre-verify
 *
 * Sends a 6-digit OTP to an email address BEFORE creating any account.
 * Nothing is written to Insforge's auth system at this point.
 *
 * SECURITY:
 *   - If the email is already registered → HTTP 409 with explicit message.
 *     No OTP is sent. Client shows the error on the register page.
 *   - If the email is new → HTTP 200 with HMAC-signed signature. OTP is sent.
 *   - Minimum 900ms response time prevents timing side-channels.
 *   - OTP is stored as SHA-256 hash — plaintext is never persisted.
 *   - Upserts: a second request for the same email resets the OTP and timer.
 *   - Returns HMAC-signed email URL to prevent tampering with verify-email link.
 */

const MIN_MS = 900;
const GENERIC = { message: "Revisa tu correo. ¿No lo ves? Busca en spam o correo no deseado." };

function buildOtpEmail(otp: string): string {
  // Render each digit as its own <td> so no letter-spacing overflow can clip
  // digits on narrow mobile email clients (Gmail app, Outlook Mobile).
  const digitCells = otp
    .split("")
    .map(
      (d) =>
        `<td style="width:48px;height:60px;text-align:center;vertical-align:middle;` +
        `background:linear-gradient(160deg,#fffbeb 0%,#fef3c7 100%);` +
        `border:2px solid #f59e0b;border-radius:10px;` +
        `font-size:32px;font-weight:800;color:#92400e;` +
        `font-family:'Courier New',Courier,monospace;` +
        `box-shadow:0 2px 6px rgba(245,158,11,0.18);" width="48" height="60">${d}</td>`,
    )
    .join(`<td style="width:8px;" width="8"></td>`);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Código de verificación — PAuleam</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <!--[if mso]><table width="520" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- ── Header gradient ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%);
                        padding:32px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:#fff;font-size:22px;font-weight:800;
                               letter-spacing:-0.5px;">PAuleam</p>
                    <p style="margin:4px 0 0;color:rgba(255,255,255,0.60);font-size:12px;">
                      Planta de Alimentos · ULEAM
                    </p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <!-- shield icon -->
                    <div style="width:40px;height:40px;background:rgba(255,255,255,0.12);
                                border-radius:50%;text-align:center;line-height:40px;
                                font-size:20px;">🔐</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px 32px;">

              <p style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:700;">
                Tu código de verificación
              </p>
              <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.5;">
                Ingresa este código en la pantalla de verificación para confirmar
                tu dirección de correo.
              </p>

              <!-- ── OTP digit cells ── -->
              <table cellpadding="0" cellspacing="0" border="0"
                     style="margin:0 auto 28px;" align="center">
                <tr>${digitCells}</tr>
              </table>

              <!-- ── Expiry pill ── -->
              <table cellpadding="0" cellspacing="0" border="0"
                     style="margin:0 auto 28px;" align="center">
                <tr>
                  <td style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:999px;
                              padding:6px 18px;font-size:13px;color:#0369a1;font-weight:600;">
                    ⏱ Expira en <strong>15 minutos</strong>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.55;">
                Solo puedes intentarlo <strong style="color:#374151;">5 veces</strong>.
                Si no solicitaste este código, puedes ignorar este mensaje.
              </p>

              <!-- ── Divider ── -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="margin:24px 0 0;">
                <tr>
                  <td style="border-top:1px solid #f3f4f6;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.6;">
                ¿No encuentras el correo? Revisa tu carpeta de
                <strong style="color:#6b7280;">spam</strong> o
                <strong style="color:#6b7280;">correo no deseado</strong>.<br>
                <span style="color:#d1d5db;">© PAuleam — Planta de Alimentos ULEAM</span>
              </p>
            </td>
          </tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
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

    // If email already registered, return 409 — no OTP sent.
    const { data: existing } = await insforge.database
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing !== null) {
      await settle();
      return NextResponse.json(
        { error: "Ya existe una cuenta con este correo. Intenta iniciar sesión o recuperar tu contraseña." },
        { status: 409 }
      );
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
  const signature = signEmailUrl(email);
  return NextResponse.json({ ...GENERIC, signature });
}
