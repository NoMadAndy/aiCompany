import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin, authError, hashPassword } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const result = await query(
      `SELECT id, email, name, role, avatar_url, last_login, created_at, api_keys
       FROM users ORDER BY id`
    );
    const users = result.rows.map((u: any) => ({
      ...u,
      api_keys: (u.api_keys || []).map((k: any) => ({
        name: k.name,
        created_at: k.created_at,
        key_preview: k.key_encrypted ? "****" + k.key_encrypted.slice(-8) : "",
      })),
    }));
    return NextResponse.json(users);
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { email, name, password, role } = await request.json();

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "E-Mail, Name und Passwort erforderlich" },
        { status: 400 }
      );
    }

    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });
    }

    const passwordHash = hashPassword(password);
    const result = await query(
      `INSERT INTO users (email, name, role, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at`,
      [email, name, role || "viewer", passwordHash]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    return authError(error);
  }
}
