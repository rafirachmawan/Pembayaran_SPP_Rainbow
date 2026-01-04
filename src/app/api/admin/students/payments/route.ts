import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  // ✅ jangan ubah logika lain: tetap pakai service role
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL || // fallback aman
    "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !service) throw new Error("Supabase env belum lengkap.");
  return createClient(url, service, { auth: { persistSession: false } });
}

type PaymentRow = {
  id: string;
  invoice_id: string;
  method: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  proof_url: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  try {
    const sb = supabaseAdmin();
    const { searchParams } = new URL(req.url);

    const nis = (searchParams.get("nis") || "").trim();
    const studentId = (searchParams.get("student_id") || "").trim();

    if (!nis && !studentId) {
      return NextResponse.json(
        { error: "Wajib kirim nis atau student_id" },
        { status: 400 }
      );
    }

    // 1) ambil student
    let student: any = null;

    if (studentId) {
      const s = await sb
        .from("students")
        .select("*")
        .eq("id", studentId)
        .maybeSingle();
      if (s.error) throw s.error;
      student = s.data;
    } else {
      // ✅ FIX: normalisasi NIS tanpa ubah logika lain
      // Contoh:
      // - "0001" -> numeric = "1"
      // - "001"  -> numeric = "1"
      // - "1"    -> numeric = "1"
      // Kalau non-angka, tetap coba exact match.
      const raw = nis;
      const numeric = raw.replace(/^0+/, ""); // hapus leading zero
      const isDigits = /^\d+$/.test(raw);

      // jika hasil numeric kosong (misal "0000"), biarkan raw
      const numericSafe = numeric.length ? numeric : raw;

      // ✅ cari siswa dengan OR: nis = raw OR nis = numeric
      // (ini supaya NIS "001" tetap ketemu kalau tersimpan "0001" atau sebaliknya)
      const s = await sb
        .from("students")
        .select("*")
        .or(
          isDigits ? `nis.eq.${raw},nis.eq.${numericSafe}` : `nis.eq.${raw}` // kalau bukan digit, jangan pakai numeric
        )
        .maybeSingle();

      if (s.error) throw s.error;
      student = s.data;
    }

    if (!student) {
      return NextResponse.json(
        { error: "Siswa tidak ditemukan." },
        { status: 404 }
      );
    }

    // 2) periode aktif (yang active=true)
    const p = await sb
      .from("spp_periods")
      .select("period,amount,spin_deadline_day,active,created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (p.error) throw p.error;

    const activePeriod = p.data || null;

    // 3) current invoice periode aktif (kalau ada)
    let currentInvoice: any = null;
    if (activePeriod?.period) {
      const ci = await sb
        .from("invoices")
        .select("*")
        .eq("student_id", student.id)
        .eq("period", activePeriod.period)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ci.error) throw ci.error;
      currentInvoice = ci.data || null;
    }

    // 4) semua invoice untuk siswa (riwayat)
    const inv = await sb
      .from("invoices")
      .select(
        "id,period,base_amount,discount_amount,final_amount,status,spun_at,paid_at,created_at"
      )
      .eq("student_id", student.id)
      .order("period", { ascending: false });

    if (inv.error) throw inv.error;

    const invoices = inv.data || [];
    const invoiceIds = invoices.map((x: any) => x.id);

    // 5) payment terakhir per invoice (ambil semua lalu map newest)
    let latestPaymentByInvoice: Record<string, PaymentRow> = {};

    if (invoiceIds.length) {
      const pay = await sb
        .from("payments")
        .select("id,invoice_id,method,status,proof_url,created_at")
        .in("invoice_id", invoiceIds)
        .order("created_at", { ascending: false });

      if (pay.error) throw pay.error;

      const rows = (pay.data || []) as PaymentRow[];
      for (const r of rows) {
        if (!latestPaymentByInvoice[r.invoice_id]) {
          latestPaymentByInvoice[r.invoice_id] = r; // karena sudah order desc
        }
      }
    }

    return NextResponse.json({
      ok: true,
      student,
      activePeriod,
      currentInvoice,
      invoices,
      latestPaymentByInvoice,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
