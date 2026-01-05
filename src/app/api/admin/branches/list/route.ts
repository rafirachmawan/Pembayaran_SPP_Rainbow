// src/app/api/admin/branches/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionCookieName, verifySession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
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

    // ✅ FIX: role kamu uppercase
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("branches")
      .select("id, code, name, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ branches: data || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
