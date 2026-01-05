import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPassword } from "@/lib/hash";
import { signSession, getSessionCookieName } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const usernameRaw = String(body.username || "").trim();
  const password = String(body.password || "");

  // ✅ login kamu bisa pakai NIS / username apa pun
  const username = usernameRaw.toLowerCase();

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username & password wajib" },
      { status: 400 }
    );
  }

  // =====================================================
  // 1) ✅ Login tabel lama: users_app (TETAP)
  // =====================================================
  {
    const { data: user, error } = await supabaseAdmin
      .from("users_app")
      .select("*")
      .eq("username", username)
      .eq("is_active", true)
      .maybeSingle();

    if (!error && user) {
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        return NextResponse.json({ error: "Login gagal" }, { status: 401 });
      }

      const token = await signSession({
        uid: user.id,
        role: user.role, // biasanya: SUPER_ADMIN / SISWA
        studentId: user.student_id ?? null,
        username: user.username,

        // optional kalau suatu saat kamu butuh
        branch_id: (user as any)?.branch_id ?? null,
        name: (user as any)?.name ?? null,
      });

      const res = NextResponse.json({ ok: true, role: user.role });
      res.cookies.set(getSessionCookieName(), token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }
  }

  // =====================================================
  // 2) ✅ Fallback: Login Admin Cabang -> branch_admins
  // =====================================================
  {
    const { data: admin, error } = await supabaseAdmin
      .from("branch_admins")
      .select("id, username, name, branch_id, password_hash, is_active")
      .eq("username", username)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !admin) {
      return NextResponse.json({ error: "Login gagal" }, { status: 401 });
    }

    const ok = await verifyPassword(password, admin.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Login gagal" }, { status: 401 });
    }

    const token = await signSession({
      uid: admin.id,
      role: "ADMIN_CABANG",
      studentId: null,
      username: admin.username,
      name: admin.name ?? null,
      branch_id: admin.branch_id ?? null,
    });

    const res = NextResponse.json({ ok: true, role: "ADMIN_CABANG" });
    res.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  }
}
