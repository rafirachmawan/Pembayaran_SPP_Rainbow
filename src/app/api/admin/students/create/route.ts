import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/hash"; // ✅ pastikan ada pasangan verifyPassword

const norm = (s: any) => String(s ?? "").trim();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const nis = norm(body.nis);
    const nama = norm(body.nama);
    const kelas = norm(body.kelas);
    const password = String(body.password ?? "");

    if (!nis || nis.length < 3)
      return NextResponse.json(
        { error: "NIS minimal 3 karakter." },
        { status: 400 }
      );
    if (!nama)
      return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
    if (!kelas)
      return NextResponse.json(
        { error: "Kelas wajib diisi." },
        { status: 400 }
      );
    if (!password || password.length < 6)
      return NextResponse.json(
        { error: "Password minimal 6 karakter." },
        { status: 400 }
      );

    // 0) cek username/nis sudah dipakai
    const cekUser = await supabaseAdmin
      .from("users_app")
      .select("id")
      .eq("username", nis)
      .maybeSingle();

    if (cekUser.error)
      return NextResponse.json(
        { error: cekUser.error.message },
        { status: 500 }
      );
    if (cekUser.data)
      return NextResponse.json(
        { error: "Akun dengan NIS ini sudah ada." },
        { status: 409 }
      );

    // 1) cek students nis sudah ada
    const cekStudent = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("nis", nis)
      .maybeSingle();

    if (cekStudent.error)
      return NextResponse.json(
        { error: cekStudent.error.message },
        { status: 500 }
      );
    if (cekStudent.data)
      return NextResponse.json(
        { error: "NIS sudah terdaftar di data siswa." },
        { status: 409 }
      );

    // 2) insert students
    const insStudent = await supabaseAdmin
      .from("students")
      .insert([{ nis, nama, kelas }])
      .select("id, nis, nama, kelas, created_at")
      .single();

    if (insStudent.error)
      return NextResponse.json(
        { error: insStudent.error.message },
        { status: 500 }
      );

    // 3) insert users_app (akun login)
    const password_hash = await hashPassword(password); // ✅ harus match verifyPassword
    const insUser = await supabaseAdmin
      .from("users_app")
      .insert([
        {
          username: nis, // ✅ username = NIS
          password_hash,
          role: "SISWA",
          student_id: insStudent.data.id,
          is_active: true,
        },
      ])
      .select("id, username, role, student_id, is_active, created_at")
      .single();

    if (insUser.error) {
      // rollback students biar tidak ada siswa tanpa akun login
      await supabaseAdmin
        .from("students")
        .delete()
        .eq("id", insStudent.data.id);
      return NextResponse.json(
        { error: insUser.error.message },
        { status: 500 }
      );
    }

    // response sesuai UI kamu: tampilkan username+password sekali
    return NextResponse.json(
      {
        ok: true,
        username: nis,
        password,
        student: insStudent.data,
        user: insUser.data,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
