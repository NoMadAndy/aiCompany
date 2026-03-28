import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, hashPassword, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "E-Mail und Passwort erforderlich" },
        { status: 400 }
      );
    }

    const result = await query(
      "SELECT id, email, name, role, password_hash, avatar_url FROM users WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    const user = result.rows[0];
    if (!verifyPassword(password, user.password_hash || "")) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    if (user.password_hash === "initial") {
      await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        hashPassword(password),
        user.id,
      ]);
    }

    await query("UPDATE users SET last_login = NOW() WHERE id = $1", [user.id]);
    const sessionId = await createSession(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });

    response.cookies.set("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server-Fehler" }, { status: 500 });
  }
}
