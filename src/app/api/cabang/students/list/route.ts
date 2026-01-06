import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, getSessionCookieName } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    // =============================
    // 1. Ambil session
    // =============================
    const cookie = req.headers.get("cookie") || "";
    const token = cookie
      .split("; ")
      .find((c) => c.startsWith(getSessionCookieName() + "="))
      ?.split("=")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySession(token);

    if (session.role !== "ADMIN_CABANG") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!session.branch_id) {
      return NextResponse.json(
        { error: "Branch tidak ditemukan di session" },
        { status: 400 }
      );
    }

    // =============================
    // 2. Query students by branch
    // =============================
    const { data, error } = await supabaseAdmin
      .from("students")
      .select(
        `
        id,
        nis,
        name:nama,
        class_name:kelas,
        created_at
      `
      )
      .eq("branch_id", session.branch_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("students list error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // =============================
    // 3. Inject is_active (dummy true)
    // =============================
    const students = (data ?? []).map((s) => ({
      ...s,
      is_active: true, // karena tabel students belum punya kolom ini
    }));

    return NextResponse.json({ students });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
