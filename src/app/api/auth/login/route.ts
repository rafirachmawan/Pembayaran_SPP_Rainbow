import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPassword } from "@/lib/hash";
import { signSession, getSessionCookieName } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const usernameRaw = String(body.username || "").trim();
  const password = String(body.password || "");

  const username = usernameRaw.toLowerCase();

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username & password wajib" },
      { status: 400 }
    );
  }

  // 1) login user lama / siswa via users_app (TETAP)
  {
    const { data: user, error } = await supabaseAdmin
      .from("users_app")
      .select("*")
      .eq("username", username)
      .eq("is_active", true)
      .maybeSingle();

    if (!error && user) {
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok)
        return NextResponse.json({ error: "Login gagal" }, { status: 401 });

      // ✅ kalau siswa: ambil branch_id dari students
      let branch_id: string | null = null;
      if (String(user.role) === "SISWA" && user.student_id) {
        const { data: st } = await supabaseAdmin
          .from("students")
          .select("branch_id")
          .eq("id", user.student_id)
          .maybeSingle();

        branch_id = (st?.branch_id as string) ?? null;
      }

      const token = await signSession({
        uid: user.id,
        role: user.role,
        studentId: user.student_id,
        username: user.username,
        branch_id,
      });

      const res = NextResponse.json({
        ok: true,
        role: user.role,
      });

      res.cookies.set(getSessionCookieName(), token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }
  }

  // 2) fallback login admin cabang
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
    if (!ok)
      return NextResponse.json({ error: "Login gagal" }, { status: 401 });

    const token = await signSession({
      uid: admin.id,
      role: "ADMIN_CABANG",
      studentId: null,
      username: admin.username,
      name: admin.name ?? null,
      branch_id: admin.branch_id,
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
