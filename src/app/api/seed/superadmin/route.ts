import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/hash";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "superadmin").trim();
  const password = String(body.password || "admin12345");

  const password_hash = await hashPassword(password);

  const { data: existing } = await supabaseAdmin
    .from("users_app")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, message: "Super admin sudah ada." });
  }

  const { error } = await supabaseAdmin.from("users_app").insert({
    username,
    password_hash,
    role: "SUPER_ADMIN",
    is_active: true,
    student_id: null,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, username, password });
}
