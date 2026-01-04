import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !service) throw new Error("Supabase env belum lengkap.");
  return createClient(url, service, { auth: { persistSession: false } });
}

function safeExtFromMime(mime: string) {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("pdf")) return "pdf";
  return "bin";
}

export async function POST(req: Request) {
  try {
    const sb = supabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const invoice_id = String(body?.invoice_id || "").trim();
    const method = String(body?.method || "TRANSFER").trim();
    const fileBase64 = String(body?.fileBase64 || "").trim(); // dataURL base64
    const mime = String(body?.mime || "").trim();
    const filename = String(body?.filename || "").trim();

    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id wajib" }, { status: 400 });
    }
    if (!fileBase64) {
      return NextResponse.json(
        { error: "Bukti bayar wajib diupload" },
        { status: 400 }
      );
    }

    // 1) pastikan invoice ada
    const inv = await sb
      .from("invoices")
      .select("id,status,student_id,period")
      .eq("id", invoice_id)
      .maybeSingle();

    if (inv.error) throw inv.error;
    if (!inv.data) {
      return NextResponse.json(
        { error: "Invoice tidak ditemukan" },
        { status: 404 }
      );
    }

    // kalau sudah paid, tidak boleh ajukan lagi
    if (String(inv.data.status).toUpperCase() === "PAID") {
      return NextResponse.json(
        { error: "Invoice sudah PAID" },
        { status: 400 }
      );
    }

    // 2) decode base64
    // fileBase64 biasanya format: "data:image/png;base64,AAAA..."
    const base64Part = fileBase64.includes(",")
      ? fileBase64.split(",")[1]
      : fileBase64;

    const buffer = Buffer.from(base64Part, "base64");

    // 3) upload ke storage
    const ext = filename?.includes(".")
      ? filename.split(".").pop()!.toLowerCase()
      : safeExtFromMime(mime);

    const path = `invoice/${invoice_id}/${Date.now()}.${ext}`;

    const up = await sb.storage.from("payment-proofs").upload(path, buffer, {
      contentType: mime || "application/octet-stream",
      upsert: true,
    });

    if (up.error) throw up.error;

    // 4) buat signed url supaya bisa ditampilkan (private bucket)
    const signed = await sb.storage
      .from("payment-proofs")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 hari

    if (signed.error) throw signed.error;

    const proof_url = signed.data.signedUrl;

    // 5) insert payments (PENDING)
    const ins = await sb
      .from("payments")
      .insert({
        invoice_id,
        method,
        status: "PENDING",
        proof_url,
      })
      .select("id,invoice_id,method,status,proof_url,created_at")
      .maybeSingle();

    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true, payment: ins.data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
