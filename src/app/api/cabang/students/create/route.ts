import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, getSessionCookieName } from "@/lib/auth";
import { hashPassword } from "@/lib/hash";

function getTokenFromCookieHeader(cookie: string, name: string) {
  return cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="))
    ?.split("=")[1];
}

export async function POST(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const token = getTokenFromCookieHeader(cookie, getSessionCookieName());
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await verifySession(token);
    if (session.role !== "ADMIN_CABANG") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const branchId = session.branch_id || null;
    if (!branchId) {
      return NextResponse.json(
        { error: "Branch tidak ditemukan di session" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const usernameRaw = String(body.username || "").trim();
    const username = usernameRaw.toLowerCase();
    const nama = String(body.nama || "").trim();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");

    if (!username || !nama || !password) {
      return NextResponse.json(
        { error: "username, nama, password wajib" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    // ===== cek username (nis) sudah ada di cabang ini? =====
    const { data: exist, error: existErr } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("branch_id", branchId)
      .eq("nis", username)
      .maybeSingle();

    if (existErr)
      return NextResponse.json({ error: existErr.message }, { status: 400 });
    if (exist)
      return NextResponse.json(
        { error: "Username sudah terdaftar di cabang ini" },
        { status: 400 }
      );

    // ===== insert students =====
    // NOTE: students.kelas NOT NULL, jadi kita isi default "-"
    let studentRow: any = null;

    // 1) coba insert pakai phone (kalau kolom ada)
    {
      const { data, error } = await supabaseAdmin
        .from("students")
        .insert({
          nis: username,
          nama,
          kelas: "-", // default (wajib)
          branch_id: branchId,
          // kalau kolom phone ada, akan masuk; kalau tidak ada, akan error dan kita retry
          phone,
        } as any)
        .select("id, nis, nama, kelas, branch_id, created_at")
        .maybeSingle();

      if (!error && data) {
        studentRow = data;
      } else if (error) {
        const msg = String(error.message || "");
        const phoneMissing =
          msg.toLowerCase().includes("column") &&
          msg.toLowerCase().includes("phone") &&
          msg.toLowerCase().includes("does not exist");
        if (!phoneMissing)
          return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    // 2) retry tanpa phone kalau kolom phone tidak ada
    if (!studentRow) {
      const { data, error } = await supabaseAdmin
        .from("students")
        .insert({
          nis: username,
          nama,
          kelas: "-",
          branch_id: branchId,
        })
        .select("id, nis, nama, kelas, branch_id, created_at")
        .single();

      if (error)
        return NextResponse.json({ error: error.message }, { status: 400 });
      studentRow = data;
    }

    // ===== buat akun login siswa di users_app (username = nis) =====
    const password_hash = await hashPassword(password);

    // coba insert users_app dengan phone kalau ada kolomnya, kalau tidak ada -> retry
    {
      const { error } = await supabaseAdmin.from("users_app").insert({
        username,
        role: "SISWA",
        student_id: studentRow.id,
        password_hash,
        is_active: true,
        phone, // optional kalau kolom ada
        // kalau suatu saat users_app punya branch_id, boleh aktifkan:
        // branch_id: branchId,
      } as any);

      if (error) {
        const msg = String(error.message || "");
        const phoneMissing =
          msg.toLowerCase().includes("column") &&
          msg.toLowerCase().includes("phone") &&
          msg.toLowerCase().includes("does not exist");

        if (!phoneMissing) {
          // rollback student
          await supabaseAdmin.from("students").delete().eq("id", studentRow.id);
          return NextResponse.json({ error: msg }, { status: 400 });
        }

        // retry tanpa phone
        const { error: e2 } = await supabaseAdmin.from("users_app").insert({
          username,
          role: "SISWA",
          student_id: studentRow.id,
          password_hash,
          is_active: true,
        });

        if (e2) {
          await supabaseAdmin.from("students").delete().eq("id", studentRow.id);
          return NextResponse.json({ error: e2.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json(
      {
        student: {
          id: studentRow.id,
          username: studentRow.nis,
          nama: studentRow.nama,
          phone: phone || null,
          created_at: studentRow.created_at,
        },
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
