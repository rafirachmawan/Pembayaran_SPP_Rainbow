import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionCookieName, verifySession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    // ===== AUTH =====
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySession(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ===== PARAMS =====
    const url = new URL(req.url);
    const branch_id = String(url.searchParams.get("branch_id") || "").trim();

    if (!branch_id) {
      return NextResponse.json({ error: "branch_id wajib" }, { status: 400 });
    }

    // ===== QUERY =====
    // ambil admin + join nama cabang
    const { data, error } = await supabaseAdmin
      .from("branch_admins")
      .select(
        `
        id,
        username,
        name,
        branch_id,
        is_active,
        created_at,
        branches:branches (
          name,
          code
        )
      `
      )
      .eq("branch_id", branch_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const admins =
      (data || []).map((row: any) => ({
        id: row.id,
        username: row.username,
        name: row.name,
        branch_id: row.branch_id,
        branch_name: row.branches?.name
          ? `${row.branches.name} (${row.branches.code})`
          : null,
        is_active: row.is_active,
        created_at: row.created_at,
      })) ?? [];

    return NextResponse.json({ admins }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
