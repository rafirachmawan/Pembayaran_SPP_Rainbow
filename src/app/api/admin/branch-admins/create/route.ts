import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { hashPassword } from "@/lib/hash"; // pastikan ada util ini (atau sesuaikan nama fungsi hash milikmu)

export async function POST(req: Request) {
  try {
    // ===== AUTH (WAJIB await cookies) =====
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySession(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // role kamu sudah terbukti uppercase di error sebelumnya
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ===== BODY =====
    const body = await req.json().catch(() => ({}));
    const branch_id = String(body.branch_id || "").trim();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");

    if (!branch_id || !username || !name || !password) {
      return NextResponse.json(
        { error: "branch_id, username, name, password wajib" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    // ===== HASH PASSWORD =====
    const password_hash = await hashPassword(password);

    // ===== INSERT =====
    // Sesuaikan nama tabel/kolom dengan DB kamu.
    // Umumnya: branch_admins(id, branch_id, username, name, password_hash, is_active, created_at)
    const { data, error } = await supabaseAdmin
      .from("branch_admins")
      .insert({
        branch_id,
        username,
        name,
        password_hash,
        is_active: true,
      })
      .select("id, branch_id, username, name, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ admin: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
