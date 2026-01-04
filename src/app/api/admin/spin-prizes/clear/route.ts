import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isMissingTableError(msg?: string) {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("could not find the table") ||
    m.includes("schema cache") ||
    m.includes("relation")
  );
}

async function tryDeletePrizeRelationsBulk(prizeIds: string[]) {
  if (!prizeIds.length) return { table: null, error: null };

  const candidates = [
    "spin_results",
    "spin_logs",
    "spin_history",
    "spin_histories",
    "student_spins",
    "spins",
    "spin_winners",
    "spin_transactions",
  ];

  for (const table of candidates) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .in("prize_id", prizeIds);

    if (error && isMissingTableError(error.message)) continue;
    if (error) return { table, error };
  }

  return { table: null, error: null };
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  if (!period)
    return NextResponse.json({ error: "period wajib" }, { status: 400 });

  // 1) ambil semua hadiah period itu
  const { data, error: errSel } = await supabaseAdmin
    .from("spin_prizes")
    .select("id")
    .eq("period", period);

  if (errSel)
    return NextResponse.json({ error: errSel.message }, { status: 400 });

  const ids = (data || []).map((r: any) => String(r.id)).filter(Boolean);

  // 2) hapus relasi (kalau ada)
  const rel = await tryDeletePrizeRelationsBulk(ids);
  if (rel.error) {
    return NextResponse.json(
      {
        error: `Gagal hapus relasi hadiah di tabel ${rel.table}: ${rel.error.message}`,
      },
      { status: 400 }
    );
  }

  // 3) hapus semua hadiah period tsb
  const { error: errDel } = await supabaseAdmin
    .from("spin_prizes")
    .delete()
    .eq("period", period);

  if (errDel)
    return NextResponse.json({ error: errDel.message }, { status: 400 });

  return NextResponse.json({ ok: true, deleted: ids.length, period });
}
