import { NextResponse } from "next/server";
import { createServerClient } from "@shared/lib/insforge/client";

/**
 * POST /api/auth/send-reset-code
 *
 * Server-side wrapper for sendResetPasswordEmail.
 *
 * SECURITY PROPERTIES:
 *   1. User enumeration prevention — always returns HTTP 200 with the same
 *      body regardless of whether the email is registered. Attackers cannot
 *      distinguish "email found" from "email not found".
 *
 *   2. Timing normalization — enforces a minimum response time so response
 *      latency cannot be used as a side-channel to infer whether the Insforge
 *      call ran or was skipped.
 *
 *   3. Server-side execution — the SDK call never originates from the browser.
 *      Clients cannot call sendResetPasswordEmail directly to probe which
 *      addresses are registered.
 *
 *   4. Email existence gate — queries profiles.email (populated by
 *      handle_new_user trigger + backfill migration 20260617000002).
 *      Non-registered emails never trigger a send; the client response is
 *      identical either way.
 */

const GENERIC_MESSAGE =
  "Si existe una cuenta con ese correo, recibirás un código en breve.";

const MIN_RESPONSE_MS = 900;

function genericResponse() {
  return NextResponse.json({ message: GENERIC_MESSAGE });
}

export async function POST(req: Request) {
  const start = Date.now();

  async function settle() {
    const elapsed = Date.now() - start;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
    }
  }

  let email: string;
  try {
    const body = (await req.json()) as { email?: unknown };
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      await settle();
      return genericResponse();
    }
    email = body.email.trim().toLowerCase();
  } catch {
    await settle();
    return genericResponse();
  }

  try {
    const insforge = createServerClient();

    // Check whether this email belongs to a registered account.
    // profiles.email is populated by the handle_new_user trigger and
    // backfilled for existing users by migration 20260617000002.
    const { data: profile } = await insforge.database
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // Only send the OTP if the account is known.
    // profile === null   → unregistered email → skip send, same client response
    // profile !== null   → registered → call Insforge
    if (profile !== null) {
      await insforge.auth.sendResetPasswordEmail({ email }).catch(() => {});
    }
  } catch {
    // Swallow all errors — never expose internal failure state to the client.
  }

  await settle();
  return genericResponse();
}
