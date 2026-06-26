// scripts/create-test-admin.mjs
// One-time: create a disposable test admin + print access token.
// The Insforge handle_new_user trigger sets role=cliente; we then UPDATE it
// to admin (or operario) directly. Token is then used by shoot-admin.mjs.

import { createClient } from "@insforge/sdk";

const BASE = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://8i4ga35v.us-east.insforge.app";
const ADMIN_KEY = process.env.INSFORGE_API_KEY;

if (!ADMIN_KEY) {
  console.error("INSFORGE_API_KEY env var is required.");
  process.exit(1);
}

const EMAIL = "admin.video@pauleam.test";
const PASSWORD = "VideoAdmin2026!";
const NAME = "Admin Video";
const ROLE = process.env.ADMIN_ROLE || "admin"; // "admin" or "operario"

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

let userId;
if (existing) {
  console.log(`admin already exists: ${existing.email} (role=${existing.role})`);
  userId = existing.id;
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
  userId = signUpData?.user?.id;
  console.log(`admin created: ${userId}`);
}

// Ensure role is what we want
if (userId) {
  const { error: updateErr } = await insforge.database
    .from("profiles")
    .update({ role: ROLE, full_name: NAME })
    .eq("id", userId);
  if (updateErr) {
    console.error("role update failed:", updateErr);
  } else {
    console.log(`role set to: ${ROLE}`);
  }
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

import { writeFile } from "node:fs/promises";
await writeFile(
  new URL("../.admin-token", import.meta.url),
  token + "\n",
  "utf8",
);
console.log(`token written to .admin-token (delete after run)`);
