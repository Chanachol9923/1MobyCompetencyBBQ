import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

/**
 * Password hashing with scrypt, which ships with Node — no native module to
 * compile on Windows or on the host.
 *
 * Stored format: scrypt$N$r$p$<salt base64>$<hash base64>
 * The parameters travel with the hash so they can be raised later without
 * invalidating existing passwords.
 *
 * Deliberately not marked server-only: the seed script runs it under plain Node.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function scryptAsync(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64!, "base64");
  const key = await scryptAsync(
    password,
    Buffer.from(saltB64!, "base64"),
    Number(n),
    Number(r),
    Number(p),
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// the rules are shared with the browser, which cannot load node:crypto
export { passwordProblems, type PasswordProblem } from "./password-rules";

/** A URL-safe one-time token, and the hash that is the only thing stored. */
export function createOneTimeToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
