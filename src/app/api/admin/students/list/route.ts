import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "")
      .trim()
      .toLowerCase();

    // ambil students
    const sRes = await supabaseAdmin
      .from("students")
      .select("id, nis, nama, kelas, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (sRes.error)
      return NextResponse.json({ error: sRes.error.message }, { status: 500 });

    // ambil users_app siswa
    const uRes = await supabaseAdmin
      .from("users_app")
      .select("id, username, student_id, is_active, created_at, role")
      .eq("role", "SISWA")
      .limit(2000);

    if (uRes.error)
      return NextResponse.json({ error: uRes.error.message }, { status: 500 });

    const userByStudentId = new Map<string, any>();
    (uRes.data || []).forEach((u) => {
      if (u.student_id) userByStudentId.set(u.student_id, u);
    });

    let merged =
      (sRes.data || []).map((s) => {
        const u = userByStudentId.get(s.id);
        return {
          id: s.id,
          nis: s.nis,
          nama: s.nama,
          kelas: s.kelas,
          created_at: s.created_at,

          // info akun login
          username: u?.username || s.nis,
          is_active: u?.is_active ?? false,
          user_id: u?.id || null,
        };
      }) || [];

    if (q) {
      merged = merged.filter((x) => {
        return (
          String(x.nis).toLowerCase().includes(q) ||
          String(x.nama).toLowerCase().includes(q) ||
          String(x.kelas).toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({ students: merged }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
