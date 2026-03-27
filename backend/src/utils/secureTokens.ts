import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function compareOpaqueToken(token: string, storedHash?: string | null): boolean {
  if (!storedHash) return false;
  const computed = hashOpaqueToken(token);
  const left = Buffer.from(computed, "utf8");
  const right = Buffer.from(storedHash, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
