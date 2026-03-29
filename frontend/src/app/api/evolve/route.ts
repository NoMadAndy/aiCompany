import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin, authError } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let sql = `
      SELECT c.*, e.name as proposed_by_name, u.name as approved_by_name
      FROM code_changes c
      LEFT JOIN employees e ON c.proposed_by = e.id
      LEFT JOIN users u ON c.approved_by = u.id
    `;
    const params: any[] = [];

    if (status) {
      sql += " WHERE c.status = $1";
      params.push(status);
    }
    sql += " ORDER BY c.created_at DESC LIMIT 50";

    const result = await query(sql, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Evolve API error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const { change_id, action } = await request.json();

    if (!change_id || !action)
      return NextResponse.json({ error: "change_id und action erforderlich" }, { status: 400 });

    const workerUrl = process.env.WORKER_URL || "http://worker:8080";

    if (action === "approve") {
      const res = await fetch(`${workerUrl}/evolve/approve/${change_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      return NextResponse.json(await res.json());
    }

    if (action === "reject") {
      await query("UPDATE code_changes SET status = 'rejected' WHERE id = $1", [change_id]);
      return NextResponse.json({ success: true });
    }

    if (action === "rollback") {
      const res = await fetch(`${workerUrl}/evolve/rollback/${change_id}`, { method: "POST" });
      return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  } catch (error) {
    return authError(error);
  }
}
