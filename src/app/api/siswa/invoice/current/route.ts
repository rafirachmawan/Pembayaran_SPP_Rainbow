import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";
import { getOrCreateInvoice } from "@/lib/spp";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Unauth" }, { status: 401 });

  const session = await verifySession(token);
  if (session.role !== "SISWA" || !session.studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getOrCreateInvoice(session.studentId);
  return NextResponse.json(data);
}
