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
  const period = String(body.period || "").trim(); // YYYY-MM
  const amount = Number(body.amount || 0);
  const spin_deadline_day = Number(body.spin_deadline_day || 11);

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json(
      { error: "Period harus format YYYY-MM" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Amount invalid" }, { status: 400 });
  }

  // nonaktifkan semua
  await supabaseAdmin
    .from("spp_periods")
    .update({ active: false })
    .neq("period", "__none__");

  // upsert period
  const { data, error } = await supabaseAdmin
    .from("spp_periods")
    .upsert(
      { period, amount, spin_deadline_day, active: true },
      { onConflict: "period" }
    )
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, period: data });
}
