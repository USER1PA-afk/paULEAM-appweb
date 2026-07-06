import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * DELETE /api/admin/delete-staff-user
 *
 * SERVER-SIDE ENFORCEMENT — Admin-only deletion of system personnel.
 *
 * Security layers (defense-in-depth, cannot be bypassed by the client):
 *   1. Cookie check: pauleam-role cookie must be "admin" (httpOnly, server-written).
 *   2. RPC check: delete_staff_user() is SECURITY DEFINER — re-verifies auth.uid()
 *      role inside PostgreSQL before doing anything.
 *   3. Self-delete protection: RPC raises if target === caller.
 *   4. Role scope: RPC raises if target role is "cliente" (not staff).
 *
 * The RPC deletes from public.profiles + records audit_log.
 * This route then calls the Insforge admin API to remove the auth.users row.
 */
export async function DELETE(request: NextRequest) {
  // ── 1. Verify caller is admin via httpOnly cookie ───────────────────────
  const roleCookie = request.cookies.get("pauleam-role")?.value;
  const sessionToken = request.cookies.get("pauleam-session")?.value;

  if (roleCookie !== "admin" || !sessionToken) {
    return NextResponse.json(
      { error: "FORBIDDEN: solo el administrador puede eliminar personal del sistema." },
      { status: 403 }
    );
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let targetUserId: string;
  try {
    const body = await request.json();
    targetUserId = body?.userId as string;
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  // ── 3. Build authenticated server client ─────────────────────────────────
  const insforge = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_API_KEY,
    edgeFunctionToken: sessionToken,
    isServerMode: true,
    timeout: 8000,
    retryCount: 0,
  });

  // ── 4. Call SECURITY DEFINER RPC ─────────────────────────────────────────
  // This verifies caller role, target role, and self-delete protection at DB level.
  const { error: rpcError } = await insforge.database.rpc("delete_staff_user", {
    p_target_user_id: targetUserId,
  });

  if (rpcError) {
    const msg: string = (rpcError as { message?: string })?.message ?? String(rpcError);

    if (msg.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "Acceso denegado. Solo el administrador puede realizar esta acción." }, { status: 403 });
    }
    if (msg.includes("USER_NOT_FOUND")) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }
    if (msg.includes("INVALID_ROLE")) {
      return NextResponse.json({ error: "Esta acción solo aplica a personal del sistema, no a clientes." }, { status: 400 });
    }
    if (msg.includes("SELF_DELETE")) {
      return NextResponse.json({ error: "No puedes eliminarte a ti mismo." }, { status: 400 });
    }

    console.error("[delete-staff-user] RPC error:", rpcError);
    return NextResponse.json({ error: "Error al eliminar usuario." }, { status: 500 });
  }

  // ── 5. Delete from auth.users via raw SQL with service-role client ───────
  // auth.admin.deleteUser is not available on the SDK Auth type.
  // We use a direct SQL query with the admin/service-role key instead.
  // The profile row is already gone (RPC handled it); this clears the auth row
  // so the user cannot create a new session with the same credentials.
  try {
    const adminClient = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,
      anonKey: process.env.INSFORGE_API_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
      isServerMode: true,
      timeout: 8000,
      retryCount: 0,
    });

    // Use the delete_auth_user RPC (SECURITY DEFINER with auth schema access)
    // that is called from the server with the service-role key.
    const { error: authDeleteError } = await adminClient.database.rpc(
      "delete_auth_user",
      { p_user_id: targetUserId }
    );
    if (authDeleteError) {
      // Profile is already deleted — user cannot authenticate anyway.
      // Log and continue rather than failing the whole operation.
      console.error("[delete-staff-user] delete_auth_user RPC error:", authDeleteError);
    }
  } catch (e) {
    console.error("[delete-staff-user] auth delete exception:", e);
  }

  return NextResponse.json({ ok: true });
}
