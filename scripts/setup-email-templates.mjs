#!/usr/bin/env node
/**
 * scripts/setup-email-templates.mjs
 *
 * One-time setup: pushes the custom PAuleam email templates to Insforge.
 * The reset-password template uses {{.Code}} as the OTP placeholder.
 *
 * Run: node scripts/setup-email-templates.mjs
 *
 * Requires: NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY in .env.local
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local manually ─────────────────────────────────────────────────
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split(/\r?\n/);
const env = {};
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const BASE_URL = env.NEXT_PUBLIC_INSFORGE_URL;
const API_KEY  = env.INSFORGE_API_KEY;

if (!BASE_URL || !API_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_INSFORGE_URL or INSFORGE_API_KEY in .env.local");
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function digitCells(placeholder) {
  // Renders {{.Code}} chars as individual cell placeholders.
  // Since the code is injected as one string by Insforge, we wrap the whole
  // block in a single wide cell and use letter-spacing instead.
  // Individual-cell approach requires knowing the digits at template-render
  // time — not possible with a server template. We use the wide-cell approach.
  return `<td style="
    background:linear-gradient(160deg,#fffbeb 0%,#fef3c7 100%);
    border:2px solid #f59e0b;
    border-radius:12px;
    padding:20px 28px;
    text-align:center;
    font-size:38px;
    font-weight:800;
    color:#92400e;
    font-family:'Courier New',Courier,monospace;
    letter-spacing:10px;
    box-shadow:0 4px 14px rgba(245,158,11,0.22);
  ">${placeholder}</td>`;
}

function buildResetTemplate(codePlaceholder) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Recuperación de contraseña — PAuleam</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <!--[if mso]><table width="520" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- ── Header ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%);
                        padding:32px 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">PAuleam</p>
                    <p style="margin:4px 0 0;color:rgba(255,255,255,0.60);font-size:12px;">Planta de Alimentos · ULEAM</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="width:40px;height:40px;background:rgba(255,255,255,0.12);border-radius:50%;
                                text-align:center;line-height:40px;font-size:20px;">🔑</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px 32px;">
              <p style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:700;">
                Recuperación de contraseña
              </p>
              <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.5;">
                Usa el siguiente código para restablecer tu contraseña. Si no solicitaste
                este cambio, ignora este mensaje.
              </p>

              <!-- OTP block -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px;" align="center">
                <tr>${digitCells(codePlaceholder)}</tr>
              </table>

              <!-- Expiry pill -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px;" align="center">
                <tr>
                  <td style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:999px;
                              padding:6px 18px;font-size:13px;color:#0369a1;font-weight:600;">
                    ⏱ Expira en <strong>15 minutos</strong>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.55;">
                Si no solicitaste este código, puedes ignorar este mensaje con seguridad.
                Nadie puede cambiar tu contraseña sin este código.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
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

// ── Push template to Insforge ─────────────────────────────────────────────────

async function pushTemplate(type, subject, bodyHtml) {
  const url = `${BASE_URL}/api/auth/email-templates/${type}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ subject, bodyHtml }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌  Failed to update template "${type}": ${res.status} ${text}`);
    return false;
  }

  console.log(`✅  Template "${type}" updated successfully.`);
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📧  Pushing email templates to ${BASE_URL}\n`);

  // Insforge uses {{.Code}} as the OTP placeholder in reset-password templates.
  // This is the Go template syntax used internally by Insforge's email renderer.
  const resetHtml = buildResetTemplate("{{.Code}}");

  await pushTemplate(
    "reset-password-code",
    "Código de recuperación — PAuleam",
    resetHtml,
  );

  console.log("\nDone. If any template failed, check that INSFORGE_API_KEY has admin-level access.");
}

main().catch((e) => { console.error(e); process.exit(1); });
