import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 *
 * Clears the httpOnly session cookies set by /api/auth/set-cookie.
 * Must be called on sign-out since JS cannot clear httpOnly cookies directly.
 */
export async function POST() {
  const isProd = process.env.NODE_ENV === "production";
  const cookieClear = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pauleam-session", "", cookieClear);
  response.cookies.set("pauleam-role", "", cookieClear);
  return response;
}
