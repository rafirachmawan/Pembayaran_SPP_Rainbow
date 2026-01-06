import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getActivePeriod() {
  const { data, error } = await supabaseAdmin
    .from("spp_periods")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data)
    throw new Error("SPP period aktif belum diset oleh admin");
  return data;
}

export async function getOrCreateInvoice(studentId: string) {
  const period = await getActivePeriod();
  const base = Number(period.amount);

  const { data: existing, error: exErr } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("student_id", studentId)
    .eq("period", period.period)
    .maybeSingle();

  if (exErr) throw new Error(exErr.message);

  // ✅ kalau invoice sudah ada: sync nominal jika status masih UNPAID/PENDING
  if (existing) {
    const st = String(existing.status || "").toUpperCase();
    const existingBase = Number(existing.base_amount ?? 0);
    const existingDisc = Number(existing.discount_amount ?? 0);

    const shouldSync =
      (st === "UNPAID" || st === "PENDING") && existingBase !== base;

    if (shouldSync) {
      const nextFinal = Math.max(0, base - existingDisc);

      const { data: updated, error: upErr } = await supabaseAdmin
        .from("invoices")
        .update({
          base_amount: base,
          final_amount: nextFinal,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (upErr) throw new Error(upErr.message);

      return { period, invoice: updated };
    }

    return { period, invoice: existing };
  }

  // ✅ kalau belum ada: buat invoice baru pakai nominal period
  const { data: created, error } = await supabaseAdmin
    .from("invoices")
    .insert({
      student_id: studentId,
      period: period.period,
      base_amount: base,
      discount_amount: 0,
      final_amount: base,
      status: "UNPAID",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return { period, invoice: created };
}
