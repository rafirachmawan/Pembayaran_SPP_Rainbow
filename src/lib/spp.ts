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

  const { data: existing } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("student_id", studentId)
    .eq("period", period.period)
    .maybeSingle();

  if (existing) return { period, invoice: existing };

  const base = Number(period.amount);

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
