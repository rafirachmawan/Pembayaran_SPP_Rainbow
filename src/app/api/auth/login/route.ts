import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPassword } from "@/lib/hash";
import { signSession, getSessionCookieName } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username & password wajib" },
      { status: 400 }
    );
  }

  const { data: user, error } = await supabaseAdmin
    .from("users_app")
    .select("*")
    .eq("username", username)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !user)
    return NextResponse.json({ error: "Login gagal" }, { status: 401 });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return NextResponse.json({ error: "Login gagal" }, { status: 401 });

  const token = await signSession({
    uid: user.id,
    role: user.role,
    studentId: user.student_id,
    username: user.username,
  });

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
