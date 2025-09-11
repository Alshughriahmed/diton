// Anonymous ID management
import { createHmac } from "crypto";

export function generateAnonId(): string {
  return (crypto as any).randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function signAnonId(id: string, secret: string): string {
  const b = Buffer.from(id, "utf8").toString("base64url");
  const s = createHmac("sha256", secret).update(b).digest("hex");
  return `${b}.${s}`;
}

export function verifyAnonId(signed: string, secret: string): string | null {
  try {
    const [b64, signature] = signed.split(".");
    if (!b64 || !signature) return null;
    
    const expected = createHmac("sha256", secret).update(b64).digest("hex");
    if (signature !== expected) return null;
    
    return Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
}