import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateInvoice, getActivePeriod } from "@/lib/spp";

function calcDiscount(base: number, type: string, value: number) {
  if (type === "NONE") return 0;
  if (type === "FIXED") return Math.max(0, value);
  if (type === "PERCENT") return Math.floor((base * Math.max(0, value)) / 100);
  return 0;
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SISWA" || !session.studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = await getActivePeriod();
  const day = new Date().getDate();
  if (day >= Number(period.spin_deadline_day)) {
    return NextResponse.json(
      {
        error: `Spin hanya berlaku sebelum tanggal ${period.spin_deadline_day}`,
      },
      { status: 400 }
    );
  }

  const { invoice } = await getOrCreateInvoice(session.studentId);

  if (invoice.status !== "UNPAID")
    return NextResponse.json(
      { error: "Invoice sudah dibayar" },
      { status: 400 }
    );
  if (invoice.spun_at)
    return NextResponse.json(
      { error: "Kamu sudah spin untuk periode ini" },
      { status: 400 }
    );

  const { data: prizes, error: pErr } = await supabaseAdmin
    .from("spin_prizes")
    .select("*")
    .eq("period", period.period)
    .eq("active", true);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  const available = (prizes || []).filter(
    (p) => Number(p.used) < Number(p.quota)
  );
  if (!available.length)
    return NextResponse.json(
      { error: "Hadiah spin habis / belum diset admin" },
      { status: 400 }
    );

  const chosen = available[Math.floor(Math.random() * available.length)];

  const base = Number(invoice.base_amount);
  let discount = calcDiscount(base, chosen.type, Number(chosen.value));
  if (discount > base) discount = base;
  const finalAmount = base - discount;

  // update quota
  const { error: upPrize } = await supabaseAdmin
    .from("spin_prizes")
    .update({ used: Number(chosen.used) + 1 })
    .eq("id", chosen.id);

  if (upPrize)
    return NextResponse.json({ error: upPrize.message }, { status: 400 });

  // update invoice
  const { data: updatedInvoice, error: upInv } = await supabaseAdmin
    .from("invoices")
    .update({
      discount_amount: discount,
      final_amount: finalAmount,
      spun_at: new Date().toISOString(),
    })
    .eq("id", invoice.id)
    .select("*")
    .single();

  if (upInv)
    return NextResponse.json({ error: upInv.message }, { status: 400 });

  // log spin
  const { error: logErr } = await supabaseAdmin.from("spin_logs").insert({
    student_id: session.studentId,
    invoice_id: invoice.id,
    prize_id: chosen.id,
    discount_amount: discount,
  });

  if (logErr)
    return NextResponse.json({ error: logErr.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    prize: { label: chosen.label, type: chosen.type, value: chosen.value },
    invoice: updatedInvoice,
  });
}
