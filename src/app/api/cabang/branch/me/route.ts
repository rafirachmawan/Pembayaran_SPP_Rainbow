import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession, getSessionCookieName } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const token = cookie
      .split("; ")
      .find((c) => c.startsWith(getSessionCookieName() + "="))
      ?.split("=")[1];

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

    const { data, error } = await supabaseAdmin
      .from("branches")
      .select("id, name, code, created_at")
      .eq("id", branchId)
      .maybeSingle();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      branch: data || { id: branchId, name: null, code: null },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
