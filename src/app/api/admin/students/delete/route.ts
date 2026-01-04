import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id"); // students.id
  const nis = searchParams.get("nis"); // students.nis / users_app.username
  if (!id && !nis)
    return NextResponse.json({ error: "id atau nis wajib" }, { status: 400 });

  // ambil student (opsional, tapi enak biar pasti)
  let student: any = null;

  if (id) {
    const r = await supabaseAdmin
      .from("students")
      .select("id, nis")
      .eq("id", id)
      .maybeSingle();
    if (r.error)
      return NextResponse.json({ error: r.error.message }, { status: 500 });
    student = r.data;
  } else {
    const r = await supabaseAdmin
      .from("students")
      .select("id, nis")
      .eq("nis", nis!)
      .maybeSingle();
    if (r.error)
      return NextResponse.json({ error: r.error.message }, { status: 500 });
    student = r.data;
  }

  // kalau student sudah tidak ada, tetap bersihkan akun login by username
  if (!student) {
    if (nis) await supabaseAdmin.from("users_app").delete().eq("username", nis);
    return NextResponse.json({
      ok: true,
      warning: "Student tidak ditemukan. users_app dibersihkan jika ada.",
    });
  }

  const studentId = student.id;
  const studentNis = String(student.nis || "").trim();

  // 1) hapus akun login (users_app) => INI KUNCI UTAMA
  const du = await supabaseAdmin
    .from("users_app")
    .delete()
    .eq("student_id", studentId);
  if (du.error) {
    // fallback kalau student_id null: hapus by username
    const du2 = await supabaseAdmin
      .from("users_app")
      .delete()
      .eq("username", studentNis);
    if (du2.error)
      return NextResponse.json({ error: du2.error.message }, { status: 500 });
  }

  // 2) hapus data student
  const ds = await supabaseAdmin.from("students").delete().eq("id", studentId);
  if (ds.error)
    return NextResponse.json({ error: ds.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
