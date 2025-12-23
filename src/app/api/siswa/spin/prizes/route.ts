import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getActivePeriod } from "@/lib/spp";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SISWA")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const period = await getActivePeriod();

  const { data, error } = await supabaseAdmin
    .from("spin_prizes")
    .select("id,label,type,value,quota,used,active")
    .eq("period", period.period)
    .eq("active", true);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  // kirim hanya hadiah yang masih tersedia (kuota > used)
  const available = (data || []).filter(
    (p) => Number(p.used) < Number(p.quota)
  );
  return NextResponse.json({
    ok: true,
    period: period.period,
    prizes: available,
  });
}
