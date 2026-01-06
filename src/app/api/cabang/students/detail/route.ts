import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, getSessionCookieName } from "@/lib/auth";

function getTokenFromCookieHeader(cookie: string, name: string) {
  return cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="))
    ?.split("=")[1];
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

    const cookie = req.headers.get("cookie") || "";
    const token = getTokenFromCookieHeader(cookie, getSessionCookieName());
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifySession(token);
    if (session.role !== "ADMIN_CABANG") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const branchId = session.branch_id || null;
    if (!branchId)
      return NextResponse.json(
        { error: "Branch tidak ada di session" },
        { status: 400 }
      );

    // ambil student, pastikan cabang sama
    const { data: s, error: sErr } = await supabaseAdmin
      .from("students")
      .select("id, nis, nama, kelas, created_at, branch_id")
      .eq("id", id)
      .eq("branch_id", branchId)
      .maybeSingle();

    if (sErr)
      return NextResponse.json({ error: sErr.message }, { status: 400 });
    if (!s)
      return NextResponse.json(
        { error: "Siswa tidak ditemukan" },
        { status: 404 }
      );

    // ambil akun users_app by student_id (untuk phone kalau ada di users_app)
    const { data: u, error: uErr } = await supabaseAdmin
      .from("users_app")
      .select("id, username, role, is_active, created_at, phone")
      .eq("student_id", s.id)
      .maybeSingle();

    // kalau kolom phone tidak ada, jangan error-in
    let phone: string | null = null;
    if (!uErr && u && (u as any).phone) phone = String((u as any).phone || "");

    return NextResponse.json({
      student: {
        id: s.id,
        username: s.nis,
        nama: s.nama,
        kelas: s.kelas,
        phone,
        is_active: u ? Boolean(u.is_active) : true,
        created_at: s.created_at,
        user_created_at: u ? u.created_at : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
