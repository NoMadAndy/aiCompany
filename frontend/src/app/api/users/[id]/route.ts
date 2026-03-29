import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin, authError, hashPassword } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);
    const result = await query(
      "SELECT id, email, name, role, avatar_url, last_login, created_at FROM users WHERE id = $1",
      [params.id]
    );
    if (result.rows.length === 0)
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return authError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.name)     { updates.push(`name = $${idx++}`);          values.push(body.name); }
    if (body.email)    { updates.push(`email = $${idx++}`);         values.push(body.email); }
    if (body.role)     { updates.push(`role = $${idx++}`);          values.push(body.role); }
    if (body.password) { updates.push(`password_hash = $${idx++}`); values.push(hashPassword(body.password)); }

    if (updates.length === 0)
      return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });

    updates.push(`updated_at = NOW()`);
    values.push(params.id);

    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}
       RETURNING id, email, name, role, updated_at`,
      values
    );

    if (result.rows.length === 0)
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);
    if (params.id === "1")
      return NextResponse.json({ error: "Admin-Benutzer kann nicht gelöscht werden" }, { status: 403 });

    await query("DELETE FROM sessions WHERE user_id = $1", [params.id]);
    await query("DELETE FROM users WHERE id = $1", [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authError(error);
  }
}
