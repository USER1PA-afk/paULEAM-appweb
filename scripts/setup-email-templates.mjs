#!/usr/bin/env node
/**
 * scripts/setup-email-templates.mjs
 *
 * Pushes the custom `reset-password-code` template to Insforge and verifies
 * the update landed by GETting it before and after the PUT.
 *
 * Note: the `email-verification-code` template is NOT pushed here — the app
 * handles registration OTPs via its own pre-verify flow
 * (app/api/auth/send-pre-verify/route.ts) using insforge.emails.send(), so
 * the platform-managed verification template is irrelevant.
 *
 * The Insforge email renderer substitutes `{{key}}` placeholders (NOT Go
 * `{{.Key}}` syntax) with the values passed to sendWithTemplate(). The
 * backend passes `{ token: code }` for the reset flow, so the placeholder
 * is `{{token}}`.
 *
 * Run: node scripts/setup-email-templates.mjs
 *
 * Requires: NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY in .env.local
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  console.error("Missing NEXT_PUBLIC_INSFORGE_URL or INSFORGE_API_KEY in .env.local");
  process.exit(1);
}

const TEMPLATES = [
  {
    type: "reset-password-code",
    subject: "Código de recuperación — PAuleam",
    vars: {
      headerIcon: "&#128273;",
      headerSubtitle: "Planta de Alimentos · ULEAM",
      bodyTitle: "Recuperación de contraseña",
      bodyDescription: "Usa el siguiente código para restablecer tu contraseña. Si no solicitaste este cambio, ignora este mensaje.",
      footerNote: "Si no solicitaste este código, puedes ignorar este mensaje con seguridad. Nadie puede cambiar tu contraseña sin este código.",
    },
  },
];

function buildTemplate({ headerIcon, headerSubtitle, bodyTitle, bodyDescription, footerNote }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${bodyTitle} — PAuleam</title>
  <style>
    @media only screen and (max-width: 480px) {
      .pau-outer  { padding: 20px 12px !important; }
      .pau-header { padding: 24px 20px 22px !important; }
      .pau-body   { padding: 28px 20px 24px !important; }
      .pau-footer { padding: 18px 20px !important; }
      .pau-otp    { font-size: 28px !important; padding: 16px 18px !important; letter-spacing: 6px !important; }
      .pau-title  { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table class="pau-outer" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;padding:36px 16px;">
    <tr>
      <td align="center">
        <!--[if mso]><table width="520" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <tr>
            <td class="pau-header" bgcolor="#1d4ed8"
                style="background-color:#1d4ed8;
                       background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%);
                       padding:30px 26px 26px;
                       mso-padding-alt:0;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="mso-table-lspace:0pt;mso-table-rspace:0pt;">
                <tr>
                  <td>
                    <p class="pau-title" style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">PAuleam</p>
                    <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:12px;">${headerSubtitle}</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <div style="width:40px;height:40px;background-color:rgba(255,255,255,0.18);border-radius:50%;
                                text-align:center;line-height:40px;font-size:20px;">${headerIcon}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="pau-body" style="background-color:#ffffff;padding:32px 26px 28px;">
              <p style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:700;">
                ${bodyTitle}
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.5;">
                ${bodyDescription}
              </p>

              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;" align="center">
                <tr>
                  <td class="pau-otp" bgcolor="#fffbeb"
                      style="background-color:#fffbeb;
                                            background:linear-gradient(160deg,#fffbeb 0%,#fef3c7 100%);
                                            border:2px solid #f59e0b;
                                            border-radius:12px;
                                            padding:18px 24px;
                                            text-align:center;
                                            font-size:36px;
                                            font-weight:800;
                                            color:#92400e;
                                            font-family:'Courier New',Courier,monospace;
                                            letter-spacing:10px;
                                            box-shadow:0 4px 14px rgba(245,158,11,0.22);">
                    {{token}}
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;" align="center">
                <tr>
                  <td style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:999px;
                              padding:6px 18px;font-size:13px;color:#0369a1;font-weight:600;">
                    Expira en <strong>15 minutos</strong>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.55;">
                ${footerNote}
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
                <tr>
                  <td style="border-top:1px solid #f3f4f6;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="pau-footer" style="background-color:#f9fafb;padding:20px 26px;border-top:1px solid #f3f4f6;">
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

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

async function pushTemplate(type, subject, bodyHtml) {
  const res = await api("PUT", `/api/auth/email-templates/${type}`, { subject, bodyHtml });
  if (!res.ok) {
    console.error(`  PUT  ${type}: ${res.status} ${JSON.stringify(res.json)}`);
    return false;
  }
  return true;
}

async function getTemplate(type) {
  const res = await api("GET", `/api/auth/email-templates`);
  if (!res.ok) return null;
  const list = res.json?.data ?? res.json?.templates ?? [];
  return list.find((t) => t.templateType === type || t.type === type) ?? null;
}

function summarize(tpl) {
  if (!tpl) return "(not found)";
  const html = tpl.bodyHtml ?? "";
  const has = (sub) => html.includes(sub);
  return [
    `subject="${tpl.subject ?? ""}"`,
    `bytes=${html.length}`,
    has("{{token}}") ? "{{token}}=yes" : "{{token}}=NO",
    has("background-color:#1d4ed8") ? "fallback=ok" : "fallback=MISSING",
    has('bgcolor="#1d4ed8"') ? "bgcolor=ok" : "bgcolor=MISSING",
    has("linear-gradient") ? "gradient=ok" : "gradient=NO",
  ].join("  ");
}

async function main() {
  console.log(new Date().toISOString())
  console.log(`\nPushing email templates to ${BASE_URL}\n`);

  console.log("Before:");
  for (const t of TEMPLATES) {
    const before = await getTemplate(t.type);
    console.log(`  ${t.type.padEnd(28)} ${summarize(before)}`);
  }

  console.log("\nPushing:");
  for (const t of TEMPLATES) {
    const html = buildTemplate(t.vars);
    const ok = await pushTemplate(t.type, t.subject, html);
    console.log(`  ${ok ? "OK  " : "FAIL"}  ${t.type}`);
  }

  console.log("\nAfter:");
  for (const t of TEMPLATES) {
    const after = await getTemplate(t.type);
    console.log(`  ${t.type.padEnd(28)} ${summarize(after)}`);
  }

  console.log("\nIf any template shows fallback=MISSING, the PUT did not persist. Check that INSFORGE_API_KEY has admin scope.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
