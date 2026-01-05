import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySession } from "@/lib/auth"; // samakan sama route list kamu
import { cookies } from "next/headers";
import { getSessionCookieName } from "@/lib/auth"; // kalau kamu pakai ini di project

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  try {
    // ====== AUTH ======
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;
    // samakan cara ambil token seperti route list kamu
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySession(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // role kamu pakai uppercase (SUPER_ADMIN) => samakan
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ====== BODY ======
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();

    if (!code || !name) {
      return NextResponse.json(
        { error: "Kode & Nama cabang wajib" },
        { status: 400 }
      );
    }

    // slug wajib ada (ambil dari code biar stabil)
    const slug = slugify(code);

    // ====== INSERT ======
    const { data, error } = await supabaseAdmin
      .from("branches")
      .insert({
        code,
        name,
        slug,
        // kalau kolom address tidak ada di DB, hapus baris ini atau ganti ke nama kolom yang benar
        address: address || null,
        is_active: true,
      })
      .select("id, code, name, slug, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ branch: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
