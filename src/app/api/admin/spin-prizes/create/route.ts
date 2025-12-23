import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const period = String(body.period || "").trim();
  const label = String(body.label || "").trim();
  const type = String(body.type || "NONE").trim(); // FIXED/PERCENT/NONE
  const value = Number(body.value || 0);
  const quota = Number(body.quota || 0);

  if (!label)
    return NextResponse.json({ error: "Label wajib" }, { status: 400 });
  if (!["FIXED", "PERCENT", "NONE"].includes(type)) {
    return NextResponse.json({ error: "Type invalid" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("spin_prizes")
    .insert({ period, label, type, value, quota, used: 0, active: true })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, prize: data });
}
