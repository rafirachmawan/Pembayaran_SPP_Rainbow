import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { getOrCreateInvoice } from "@/lib/spp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SISWA" || !session.studentId || !session.username) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ✅ cek akun masih ada & aktif
  const u = await supabaseAdmin
    .from("users_app")
    .select("id, is_active")
    .eq("username", session.username)
    .maybeSingle();

  if (u.error)
    return NextResponse.json({ error: u.error.message }, { status: 500 });
  if (!u.data || u.data.is_active !== true) {
    return NextResponse.json(
      { error: "Akun sudah dihapus / nonaktif" },
      { status: 401 }
    );
  }

  const data = await getOrCreateInvoice(session.studentId);
  return NextResponse.json(data);
}
