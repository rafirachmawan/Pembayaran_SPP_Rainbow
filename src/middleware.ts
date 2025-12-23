import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSessionCookieName } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const protectedAdmin = pathname.startsWith("/admin");
  const protectedSiswa = pathname.startsWith("/siswa");

  if (!protectedAdmin && !protectedSiswa) return NextResponse.next();

  const token = req.cookies.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const session = await verifySession(token);

    if (protectedAdmin && session.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/siswa", req.url));
    }
    if (protectedSiswa && session.role !== "SISWA") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/siswa/:path*"],
};
