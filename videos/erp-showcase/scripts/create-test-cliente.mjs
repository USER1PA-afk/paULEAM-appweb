// scripts/create-test-cliente.mjs
// One-time: create a disposable test cliente + print access token.
// Uses the admin INSFORGE_API_KEY in server mode (bypasses email verification).
// Token is then used by shoot-cliente-mobile.mjs.

import { createClient } from "@insforge/sdk";

const BASE = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://8i4ga35v.us-east.insforge.app";
const ADMIN_KEY = process.env.INSFORGE_API_KEY;

if (!ADMIN_KEY) {
  console.error("INSFORGE_API_KEY env var is required.");
  process.exit(1);
}

const EMAIL = "cliente.video@pauleam.test";
const PASSWORD = "VideoCliente2026!";
const NAME = "Cliente Video";

const insforge = createClient({
  baseUrl: BASE,
  anonKey: ADMIN_KEY,
  isServerMode: true,
  timeout: 10000,
  retryCount: 1,
});

const { data: existing } = await insforge.database
  .from("profiles")
  .select("id, email, role")
  .eq("email", EMAIL)
  .maybeSingle();

if (existing) {
  console.log(`cliente already exists: ${existing.email} (role=${existing.role})`);
} else {
  const { data: signUpData, error: signUpErr } = await insforge.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    name: NAME,
  });
  if (signUpErr) {
    console.error("signUp failed:", signUpErr);
    process.exit(1);
  }
  console.log(`cliente created: ${signUpData?.user?.id ?? "?"}`);
}

const { data: session, error: signInErr } = await insforge.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});

if (signInErr || !session) {
  console.error("signIn failed:", signInErr);
  process.exit(1);
}

const token = session.accessToken ?? session.access_token ?? session.session?.access_token;
console.log(`token=${token}`);

// Write to .cliente-token for shoot-cliente-mobile.mjs to read
import { writeFile } from "node:fs/promises";
await writeFile(
  new URL("../.cliente-token", import.meta.url),
  token + "\n",
  "utf8",
);
console.log(`token written to .cliente-token (delete after run)`);
