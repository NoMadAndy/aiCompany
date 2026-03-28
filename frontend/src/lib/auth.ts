import crypto from "crypto";
import { query } from "./db";

const SECRET = process.env.SESSION_SECRET || "aicompany-secret-change-me";

export function hashPassword(plain: string): string {
  return crypto.createHash("sha256").update(plain + SECRET).digest("hex");
}

export function verifyPassword(plain: string, hash: string): boolean {
  if (hash === "initial") return plain === "admin";
  return hashPassword(plain) === hash;
}

export function generateSessionId(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function encrypt(text: string): string {
  const key = crypto.createHash("sha256").update(SECRET).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + tag + ":" + encrypted;
}

export function decrypt(ciphertext: string): string {
  const key = crypto.createHash("sha256").update(SECRET).digest();
  const [ivHex, tagHex, encrypted] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: string;
  avatar_url: string | null;
}

export async function createSession(userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await query(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
    [sessionId, userId, expiresAt]
  );
  return sessionId;
}

export async function validateSession(
  request: Request
): Promise<SessionUser | null> {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_id=([^;]+)/);
  if (!match) return null;

  const sessionId = match[1];
  const result = await query(
    `SELECT u.id, u.email, u.name, u.role, u.avatar_url
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0] as SessionUser;
}

export async function requireAuth(request: Request): Promise<SessionUser> {
  const user = await validateSession(request);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await requireAuth(request);
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export function authError(error: unknown) {
  const msg = error instanceof Error ? error.message : "ERROR";
  if (msg === "UNAUTHORIZED")
    return new Response(JSON.stringify({ error: "Nicht angemeldet" }), {
      status: 401,
    });
  if (msg === "FORBIDDEN")
    return new Response(JSON.stringify({ error: "Keine Berechtigung" }), {
      status: 403,
    });
  return new Response(JSON.stringify({ error: "Server-Fehler" }), {
    status: 500,
  });
}
