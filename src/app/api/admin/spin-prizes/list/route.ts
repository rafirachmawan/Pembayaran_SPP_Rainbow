import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const period = String(searchParams.get("period") || "").trim();
  if (!period) return NextResponse.json({ prizes: [] });

  const { data, error } = await supabaseAdmin
    .from("spin_prizes")
    // ✅ PENTING: pastikan weight ikut keambil
    .select("id,label,type,value,quota,used,active,weight,created_at")
    .eq("period", period)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, prizes: data || [] });
}
