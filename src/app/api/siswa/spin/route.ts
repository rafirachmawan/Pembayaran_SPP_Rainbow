import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getActivePeriod } from "@/lib/spp";

type PrizeRow = {
  id: string;
  label: string;
  type: "FIXED" | "PERCENT" | "NONE";
  value: number;
  quota: number;
  used: number;
  active: boolean;
  weight: number;
};

function pickWeighted(prizes: PrizeRow[]) {
  const eligible = prizes.filter(
    (p) =>
      p.active === true &&
      Number(p.quota) > Number(p.used) &&
      Number(p.weight) > 0
  );

  const total = eligible.reduce((acc, p) => acc + Number(p.weight || 0), 0);
  if (!eligible.length || total <= 0) return null;

  let r = Math.floor(Math.random() * total) + 1; // 1..total
  for (const p of eligible) {
    r -= Number(p.weight || 0);
    if (r <= 0) return p;
  }
  return eligible[eligible.length - 1];
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SISWA")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const studentId = String(session.studentId || "");
  if (!studentId)
    return NextResponse.json({ error: "StudentId kosong" }, { status: 400 });

  // period aktif
  const period = await getActivePeriod();

  // cek deadline spin
  const now = new Date();
  const day = now.getDate();
  const deadlineDay = Number(period.spin_deadline_day || 11);
  if (day > deadlineDay) {
    return NextResponse.json(
      { error: `Spin hanya boleh sampai tanggal ${deadlineDay}.` },
      { status: 400 }
    );
  }

  // ambil invoice current (mengikuti pola invoice/current milikmu)
  const invRes = await supabaseAdmin
    .from("invoices")
    .select(
      "id, student_id, period, base_amount, discount_amount, final_amount, status, spun_at"
    )
    .eq("student_id", studentId)
    .eq("period", period.period)
    .maybeSingle();

  if (invRes.error) {
    return NextResponse.json({ error: invRes.error.message }, { status: 400 });
  }
  const invoice = invRes.data;

  if (!invoice) {
    return NextResponse.json(
      {
        error:
          "Invoice periode aktif belum dibuat. Minta admin set period / reload invoice.",
      },
      { status: 400 }
    );
  }

  // pastikan belum spin
  if (invoice.spun_at) {
    return NextResponse.json(
      { error: "Kamu sudah spin untuk periode ini." },
      { status: 400 }
    );
  }

  // ambil hadiah (eligible)
  const prizeRes = await supabaseAdmin
    .from("spin_prizes")
    .select("id,label,type,value,quota,used,active,weight")
    .eq("period", period.period)
    .eq("active", true);

  if (prizeRes.error) {
    return NextResponse.json(
      { error: prizeRes.error.message },
      { status: 400 }
    );
  }

  // pilih hadiah pakai weight
  let chosen = pickWeighted((prizeRes.data || []) as PrizeRow[]);
  if (!chosen) {
    return NextResponse.json(
      { error: "Hadiah tidak tersedia / kuota habis / weight 0." },
      { status: 400 }
    );
  }

  // ✅ aman kuota: update used +1 dengan retry kecil kalau bentrok
  let updatedPrize: PrizeRow | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const currentUsed = Number(chosen.used || 0);
    const currentQuota = Number(chosen.quota || 0);
    if (currentUsed >= currentQuota) {
      // ambil ulang data & pilih ulang
      const refetch = await supabaseAdmin
        .from("spin_prizes")
        .select("id,label,type,value,quota,used,active,weight")
        .eq("period", period.period)
        .eq("active", true);

      if (refetch.error) break;
      chosen = pickWeighted((refetch.data || []) as PrizeRow[]);
      if (!chosen) break;
      continue;
    }

    const upd = await supabaseAdmin
      .from("spin_prizes")
      .update({ used: currentUsed + 1 })
      .eq("id", chosen.id)
      .eq("used", currentUsed) // optimistic lock
      .select("id,label,type,value,quota,used,active,weight")
      .maybeSingle();

    if (upd.error) {
      // retry
      continue;
    }
    if (upd.data) {
      updatedPrize = upd.data as PrizeRow;
      break;
    }
  }

  if (!updatedPrize) {
    return NextResponse.json(
      { error: "Gagal mengunci kuota hadiah. Coba lagi." },
      { status: 409 }
    );
  }

  // hitung diskon
  const baseAmount = Number(invoice.base_amount || 0);
  let discount = 0;

  if (updatedPrize.type === "FIXED") {
    discount = Math.max(
      0,
      Math.min(baseAmount, Number(updatedPrize.value || 0))
    );
  } else if (updatedPrize.type === "PERCENT") {
    const pct = Math.max(0, Number(updatedPrize.value || 0));
    discount = Math.floor((baseAmount * pct) / 100);
    discount = Math.max(0, Math.min(baseAmount, discount));
  } else {
    discount = 0;
  }

  const finalAmount = Math.max(0, baseAmount - discount);

  // update invoice
  const upInv = await supabaseAdmin
    .from("invoices")
    .update({
      discount_amount: discount,
      final_amount: finalAmount,
      spun_at: now.toISOString(),
    })
    .eq("id", invoice.id)
    .select("id, base_amount, discount_amount, final_amount, spun_at")
    .maybeSingle();

  if (upInv.error) {
    return NextResponse.json({ error: upInv.error.message }, { status: 400 });
  }

  // catat spin_logs
  const insLog = await supabaseAdmin.from("spin_logs").insert({
    student_id: studentId,
    invoice_id: invoice.id,
    prize_id: updatedPrize.id,
    discount_amount: discount,
    spun_at: now.toISOString(),
  });

  if (insLog.error) {
    // invoice sudah terupdate, log gagal—kita tetap balikin sukses tapi kasih warning
    return NextResponse.json({
      ok: true,
      warning: insLog.error.message,
      prize: updatedPrize,
      invoice: upInv.data,
    });
  }

  return NextResponse.json({
    ok: true,
    prize: updatedPrize,
    invoice: upInv.data,
  });
}
