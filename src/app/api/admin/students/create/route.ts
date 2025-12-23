import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/hash";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const nis = String(body.nis || "").trim();
  const nama = String(body.nama || "").trim();
  const kelas = String(body.kelas || "").trim();
  const password = String(body.password || "123456").trim();

  if (!nis || !nama || !kelas)
    return NextResponse.json(
      { error: "nis/nama/kelas wajib" },
      { status: 400 }
    );

  const { data: student, error: sErr } = await supabaseAdmin
    .from("students")
    .insert({ nis, nama, kelas })
    .select("*")
    .single();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

  const password_hash = await hashPassword(password);

  const { error: uErr } = await supabaseAdmin.from("users_app").insert({
    username: nis,
    password_hash,
    role: "SISWA",
    student_id: student.id,
    is_active: true,
  });

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, student, username: nis, password });
}
