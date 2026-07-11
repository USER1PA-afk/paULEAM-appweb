import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const s = process.env.AUTH_COOKIE_SECRET;
  if (!s) throw new Error("AUTH_COOKIE_SECRET is not set");
  return s;
}

export function signEmailUrl(email: string): string {
  const ts = Date.now().toString();
  const payload = `${email}|${ts}`;
  const hmac = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}|${hmac}`).toString("base64url");
}

export function verifyEmailUrlSignature(
  email: string,
  signature: string
): boolean {
  try {
    const decoded = Buffer.from(signature, "base64url").toString("utf8");
    const lastPipe = decoded.lastIndexOf("|");
    const secondLastPipe = decoded.lastIndexOf("|", lastPipe - 1);
    if (lastPipe === -1 || secondLastPipe === -1) return false;

    const sigEmail = decoded.slice(0, secondLastPipe);
    const ts = decoded.slice(secondLastPipe + 1, lastPipe);
    const hmac = decoded.slice(lastPipe + 1);

    if (sigEmail !== email) return false;
    if (Date.now() - parseInt(ts, 10) > 30 * 60 * 1000) return false;

    const payload = `${sigEmail}|${ts}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");

    const hmacBuf = Buffer.from(hmac, "hex");
    const expBuf = Buffer.from(expected, "hex");
    return hmacBuf.length === expBuf.length && timingSafeEqual(hmacBuf, expBuf);
  } catch {
    return false;
  }
}
