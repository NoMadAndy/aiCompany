import { NextResponse } from "next/server";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");

    let sql = `
      SELECT m.*, e.name as employee_name
      FROM agent_memory m
      JOIN employees e ON m.employee_id = e.id
    `;
    const params: any[] = [];

    if (employeeId) {
      sql += " WHERE m.employee_id = $1";
      params.push(employeeId);
    }
    sql += " ORDER BY m.relevance_score DESC, m.created_at DESC LIMIT 100";

    const memoriesResult = await query(sql, params);

    const metricsResult = await query(`
      SELECT m.*, e.name as employee_name
      FROM agent_metrics m
      JOIN employees e ON m.employee_id = e.id
      ORDER BY m.period_end DESC LIMIT 20
    `);

    return NextResponse.json({
      memories: memoriesResult.rows,
      metrics: metricsResult.rows,
    });
  } catch (error) {
    console.error("Memory API error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}
