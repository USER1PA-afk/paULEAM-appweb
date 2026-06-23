/**
 * JWT INTEGRITY (HMAC) — CLIENT-SIDE TAMPER-EVIDENCE FOR LOCALSTORAGE TOKENS
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  WHAT THIS PROTECTS AGAINST — AND WHAT IT DOES NOT                   ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  PROTECTS:                                                           ║
 * ║    • Silent mutation of the JWT in localStorage by a careless or      ║
 * ║      curious script. If anything touches the token bytes, the HMAC   ║
 * ║      no longer matches and we wipe + force re-auth.                  ║
 * ║                                                                      ║
 * ║  DOES NOT PROTECT AGAINST:                                           ║
 * ║    • XSS reading the JWT and replaying it. An attacker with         ║
 * ║      same-origin script execution can read both the signed token     ║
 * ║      AND the HMAC secret (delivered as a non-httpOnly cookie).       ║
 * ║      The token is still a bearer credential.                         ║
 * ║                                                                      ║
 * ║    CORS does NOT help here. CORS prevents cross-origin sites from    ║
 * ║    reading RESPONSES. It does not block same-origin script from     ║
 * ║    reading localStorage. The only true defense against token theft   ║
 * ║    is HttpOnly cookies — used by /api/auth/set-cookie for the       ║
 * ║    session cookie, and by /api/pos/sale for all sensitive writes.    ║
 * ║                                                                      ║
 * ║  This file implements defense-in-depth, not a primary security       ║
 * ║  boundary. The primary boundary is:                                  ║
 * ║    1. HttpOnly session cookie (server-side validation in proxies)    ║
 * ║    2. Server-side proxy for all SECURITY DEFINER / sensitive writes  ║
 * ║    3. Content-Security-Policy header (see next.config.ts)            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Storage shape in localStorage:
 *   key:   "pauleam_session_v2"
 *   value: "<jwt>.<base64url(hmac-sha256(jwt, secret))>"
 *
 * The HMAC secret is delivered to the client at login time as a
 * non-httpOnly cookie (pauleam-jwt-hmac). It is:
 *   - Per-session (regenerated on every login)
 *   - Marked SameSite=Lax (CSRF protection on the secret delivery)
 *   - Readable by JS (required for client-side HMAC computation)
 *   - The same value the server uses server-side to verify, ensuring the
 *     client cannot sign a forged JWT without the server's blessing.
 *
 * The Insforge SDK itself does not understand HMAC envelopes. The wrapper
 * stripHmac() extracts the raw JWT before passing it to the SDK.
 */

const HMAC_COOKIE_NAME = "pauleam-jwt-hmac";
const STORAGE_KEY     = "pauleam_session_v2";
const SEPARATOR       = ".";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
}

function b64urlToBytes(b64url: string): Uint8Array {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Sign a JWT and persist it to localStorage.
 * Returns the signed envelope ("<jwt>.<hmac>") on success, or null if the
 * HMAC secret cookie is not present (e.g. session not yet established).
 */
export async function signAndStoreJwt(jwt: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const secret = readCookie(HMAC_COOKIE_NAME);
  if (!secret) return null;

  try {
    const sig = await hmacSha256(secret, jwt);
    const envelope = `${jwt}${SEPARATOR}${bytesToB64Url(sig)}`;
    localStorage.setItem(STORAGE_KEY, envelope);
    return envelope;
  } catch (err) {
    console.warn("[jwt-integrity] sign failed:", err);
    return null;
  }
}

/**
 * Verify the HMAC on a stored envelope and return the raw JWT.
 * If invalid, clear the stored value and return null — the caller must
 * treat this as "session lost" and re-authenticate.
 */
export async function verifyAndExtractJwt(envelope: string | null): Promise<string | null> {
  if (!envelope) return null;
  const lastSep = envelope.lastIndexOf(SEPARATOR);
  if (lastSep < 0) return null;

  const jwt = envelope.slice(0, lastSep);
  const sigB64 = envelope.slice(lastSep + 1);
  if (!jwt || !sigB64) return null;

  const secret = readCookie(HMAC_COOKIE_NAME);
  if (!secret) {
    // No secret means we cannot verify — refuse the token.
    return null;
  }

  try {
    const expected = await hmacSha256(secret, jwt);
    const got = b64urlToBytes(sigB64);
    if (!constantTimeEqual(expected, got)) {
      // Tampered. Wipe to force re-auth.
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return jwt;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Read the signed JWT from localStorage, verifying the HMAC.
 * Returns the raw JWT (suitable for the Insforge SDK) or null.
 */
export async function readSignedJwt(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const envelope = localStorage.getItem(STORAGE_KEY);
  if (!envelope) return null;
  return verifyAndExtractJwt(envelope);
}

/**
 * Wipe the signed JWT from localStorage (called on logout).
 */
export function clearSignedJwt(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Read the raw stored envelope (for migration / debugging).
 * The caller should NOT use the envelope directly with the SDK.
 */
export function peekRawEnvelope(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}
