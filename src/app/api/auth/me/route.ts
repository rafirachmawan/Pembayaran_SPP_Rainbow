import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getSessionCookieName())?.value;

    if (!token) return NextResponse.json({ user: null }, { status: 200 });

    const session = await verifySession(token);

    // ✅ ambil detail cabang kalau ada branch_id
    let branch: any = null;
    if (session.branch_id) {
      const { data } = await supabaseAdmin
        .from("branches")
        .select("id, name, code")
        .eq("id", session.branch_id)
        .maybeSingle();

      branch = data ?? null;
    }

    return NextResponse.json({
      user: {
        uid: session.uid,
        role: session.role,
        studentId: session.studentId,
        username: session.username,
        name: session.name ?? null,
        branch_id: session.branch_id ?? null,
        branch,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
