// scripts/diagnose-cliente.mjs
// Debug: look up user by email in both auth.users and profiles.

import { createClient } from "@insforge/sdk";

const BASE = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://8i4ga35v.us-east.insforge.app";
const ADMIN_KEY = process.env.INSFORGE_API_KEY;

const insforge = createClient({
  baseUrl: BASE,
  anonKey: ADMIN_KEY,
  isServerMode: true,
  timeout: 10000,
  retryCount: 1,
});

const { data: profiles } = await insforge.database
  .from("profiles")
  .select("id, email, role, full_name")
  .ilike("email", "%cliente.video%");
console.log("profiles matching cliente.video:", JSON.stringify(profiles, null, 2));

const { data: allProfiles } = await insforge.database
  .from("profiles")
  .select("id, email, role, full_name")
  .order("created_at", { ascending: false })
  .limit(10);
console.log("latest 10 profiles:", JSON.stringify(allProfiles, null, 2));
