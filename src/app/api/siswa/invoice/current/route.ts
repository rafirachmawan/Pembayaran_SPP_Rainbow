import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { getOrCreateInvoice } from "@/lib/spp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function pickName(obj: any) {
  if (!obj) return "";
  return String(
    obj.full_name ||
      obj.nama_lengkap ||
      obj.nama ||
      obj.name ||
      obj.username ||
      ""
  ).trim();
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SISWA" || !session.studentId || !session.username) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ✅ cek akun masih ada & aktif (pakai select(*) biar gak error kolom)
  const u = await supabaseAdmin
    .from("users_app")
    .select("*")
    .eq("username", session.username)
    .maybeSingle();

  if (u.error)
    return NextResponse.json({ error: u.error.message }, { status: 500 });
  if (!u.data || u.data.is_active !== true) {
    return NextResponse.json(
      { error: "Akun sudah dihapus / nonaktif" },
      { status: 401 }
    );
  }

  // ✅ ambil data student (kalau tabel/kolom beda-beda, tetap aman)
  const s = await supabaseAdmin
    .from("students")
    .select("*")
    .eq("id", session.studentId)
    .maybeSingle();

  // NOTE: kalau tabel students tidak ada / RLS / error, jangan bikin seluruh page rusak
  // cukup biarkan student null
  const studentData = s?.error ? null : s?.data || null;

  const data = await getOrCreateInvoice(session.studentId);

  return NextResponse.json({
    ...data, // jangan ubah struktur invoice/period yg sudah dipakai UI
    session: {
      username: session.username,
      role: session.role,
      studentId: session.studentId,
    },
    user: {
      username: session.username,
      name: pickName(u.data) || pickName(studentData) || session.username,
    },
    student: studentData
      ? {
          id: studentData.id,
          name: pickName(studentData) || pickName(u.data) || session.username,
          raw: studentData, // kalau kamu butuh debug/cek field apa yang ada
        }
      : null,
  });
}
