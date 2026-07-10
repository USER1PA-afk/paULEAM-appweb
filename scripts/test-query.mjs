import { createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;

if (!baseUrl || !apiKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const client = createClient({ baseUrl, anonKey: apiKey, isServerMode: true });

async function main() {
  const { data, error } = await client.database
    .from("production_requests")
    .select("*, products(id, name, sku, price, conversion_factor, sales_unit_name, unit, image_url), profiles(full_name, email)")
    .order("created_at", { ascending: false });

  console.log("Error:", error);
  console.log("Data count:", data?.length ?? 0);
  console.log("First row:", data?.[0]);
}

main();
