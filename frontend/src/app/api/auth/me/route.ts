import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await validateSession(request);
    if (!user) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
