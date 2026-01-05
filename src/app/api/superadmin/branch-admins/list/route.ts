import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionCookieName, verifySession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    // ===== ambil token dari cookie =====
    const cookieName = getSessionCookieName();
    const cookie = req.headers.get("cookie") || "";
    const raw = cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="));

    const token = raw
      ? decodeURIComponent(raw.split("=").slice(1).join("="))
      : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySession(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // super admin only
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branch_id = searchParams.get("branch_id") || "";

    // ===== query admin cabang =====
    // NOTE: sesuaikan nama tabel kalau beda
    let q = supabaseAdmin
      .from("admin_users")
      .select("id, username, name, role, branch_id, is_active, created_at")
      .eq("role", "ADMIN_CABANG")
      .order("created_at", { ascending: false });

    if (branch_id) q = q.eq("branch_id", branch_id);

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ admins: data || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
