import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSessionCookieName } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const protectedAdmin = pathname.startsWith("/admin");
  const protectedSiswa = pathname.startsWith("/siswa");
  const protectedCabang = pathname.startsWith("/cabang");

  if (!protectedAdmin && !protectedSiswa && !protectedCabang)
    return NextResponse.next();

  const token = req.cookies.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const session = await verifySession(token);

    if (protectedAdmin && session.role !== "SUPER_ADMIN") {
      // selain SUPER_ADMIN jangan masuk admin
      if (session.role === "SISWA")
        return NextResponse.redirect(new URL("/siswa", req.url));
      return NextResponse.redirect(new URL("/cabang", req.url));
    }

    if (protectedCabang && session.role !== "ADMIN_CABANG") {
      if (session.role === "SUPER_ADMIN")
        return NextResponse.redirect(new URL("/admin", req.url));
      return NextResponse.redirect(new URL("/siswa", req.url));
    }

    if (protectedSiswa && session.role !== "SISWA") {
      if (session.role === "SUPER_ADMIN")
        return NextResponse.redirect(new URL("/admin", req.url));
      return NextResponse.redirect(new URL("/cabang", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/siswa/:path*", "/cabang/:path*"],
};
