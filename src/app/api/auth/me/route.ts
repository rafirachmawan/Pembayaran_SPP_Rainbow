import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, verifySession } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;

  if (!token) return NextResponse.json({ user: null });

  try {
    const session = await verifySession(token);
    return NextResponse.json({ user: session });
  } catch {
    return NextResponse.json({ user: null });
  }
}
