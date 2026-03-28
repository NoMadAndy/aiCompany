import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/session_id=([^;]+)/);
    if (match) {
      await query("DELETE FROM sessions WHERE id = $1", [match[1]]);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("session_id", "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
