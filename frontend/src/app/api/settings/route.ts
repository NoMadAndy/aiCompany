import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth, authError, encrypt, decrypt } from "@/lib/auth";
export const dynamic = "force-dynamic";

// GET: Load current user's settings + API keys
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const result = await query(
      "SELECT settings, api_keys FROM users WHERE id = $1",
      [user.id]
    );
    if (result.rows.length === 0)
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const row = result.rows[0];
    const apiKeys = (row.api_keys || []).map((k: any) => ({
      name: k.name,
      created_at: k.created_at,
      has_value: !!k.key_encrypted,
    }));

    return NextResponse.json({
      settings: row.settings || {},
      api_keys: apiKeys,
    });
  } catch (error) {
    return authError(error);
  }
}

// POST: Save settings or API key
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    // Save an API key
    if (body.action === "save_key") {
      const { name, value } = body;
      if (!name || !value)
        return NextResponse.json({ error: "Name und Wert erforderlich" }, { status: 400 });

      const encrypted = encrypt(value);
      const result = await query("SELECT api_keys FROM users WHERE id = $1", [user.id]);
      const existing = result.rows[0]?.api_keys || [];

      // Update or add
      const idx = existing.findIndex((k: any) => k.name === name);
      const entry = { name, key_encrypted: encrypted, created_at: new Date().toISOString() };
      if (idx >= 0) {
        existing[idx] = entry;
      } else {
        existing.push(entry);
      }

      await query("UPDATE users SET api_keys = $1 WHERE id = $2", [
        JSON.stringify(existing),
        user.id,
      ]);

      return NextResponse.json({ success: true });
    }

    // Delete an API key
    if (body.action === "delete_key") {
      const { name } = body;
      const result = await query("SELECT api_keys FROM users WHERE id = $1", [user.id]);
      const existing = (result.rows[0]?.api_keys || []).filter((k: any) => k.name !== name);
      await query("UPDATE users SET api_keys = $1 WHERE id = $2", [
        JSON.stringify(existing),
        user.id,
      ]);
      return NextResponse.json({ success: true });
    }

    // Save general settings (overrides)
    if (body.action === "save_settings") {
      const { settings } = body;
      await query("UPDATE users SET settings = $1 WHERE id = $2", [
        JSON.stringify(settings || {}),
        user.id,
      ]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  } catch (error) {
    return authError(error);
  }
}
