import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Find user
    const users = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1);

    if (users.length === 0) {
      return Response.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    const user = users[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return Response.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    // Create session
    await createSession(user.id, user.username);

    return Response.json({ success: true, username: user.username });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}
