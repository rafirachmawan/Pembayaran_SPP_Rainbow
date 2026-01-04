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

  // boleh pakai student_id atau nis
  const student_id = searchParams.get("student_id");
  const nis = searchParams.get("nis");

  if (!student_id && !nis) {
    return NextResponse.json(
      { error: "student_id atau nis wajib" },
      { status: 400 }
    );
  }

  // ambil data siswa dulu (biar bisa delete mapping / auth user kalau ada)
  const findQuery = supabaseAdmin.from("students").select("*").limit(1);

  const findRes = student_id
    ? await findQuery.eq("id", student_id).maybeSingle()
    : await findQuery.eq("nis", nis as string).maybeSingle();

  if (findRes.error) {
    return NextResponse.json({ error: findRes.error.message }, { status: 400 });
  }

  const student: any = findRes.data;
  if (!student) {
    return NextResponse.json(
      { error: "Siswa tidak ditemukan" },
      { status: 404 }
    );
  }

  // ==========
  // 1) Hapus data siswa di tabel students
  // ==========
  const delStudentRes = await supabaseAdmin
    .from("students")
    .delete()
    .eq("id", student.id);

  if (delStudentRes.error) {
    return NextResponse.json(
      { error: delStudentRes.error.message },
      { status: 400 }
    );
  }

  // ==========
  // 2) Opsional: kalau kamu punya tabel mapping username -> student_id
  // (kalau tidak ada, biarin aja; kita ignore error)
  // ==========
  try {
    if (student.username) {
      await supabaseAdmin
        .from("usernames")
        .delete()
        .eq("username", student.username);
    } else if (student.nis) {
      await supabaseAdmin
        .from("usernames")
        .delete()
        .eq("username", student.nis);
    }
  } catch (_) {
    // ignore
  }

  // ==========
  // 3) Opsional: kalau akun siswa dibuat di Supabase Auth dan kamu simpan uid-nya
  // misal kolom: auth_user_id / user_id / uid
  // ==========
  const authUserId =
    student.auth_user_id || student.user_id || student.uid || null;

  if (authUserId) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(String(authUserId));
    } catch (_) {
      // ignore (biar delete students tetap sukses)
    }
  }

  return NextResponse.json({ ok: true });
}
