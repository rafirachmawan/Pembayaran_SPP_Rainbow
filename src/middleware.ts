import { NextRequest, NextResponse } from "next/server";
import { verifySession, getSessionCookieName } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const protectedAdmin = pathname.startsWith("/admin");
  const protectedSiswa = pathname.startsWith("/siswa");

  // ✅ tambahan: area admin cabang
  const protectedCabang =
    pathname.startsWith("/cabang") || pathname.startsWith("/admin-cabang");

  if (!protectedAdmin && !protectedSiswa && !protectedCabang) {
    return NextResponse.next();
  }

  const token = req.cookies.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const session = await verifySession(token);

    // =========================
    // /admin => SUPER_ADMIN
    // =========================
    if (protectedAdmin) {
      if (session.role === "SUPER_ADMIN") return NextResponse.next();

      // ✅ admin cabang jangan dilempar ke /siswa (biar gak loop)
      if (session.role === "ADMIN_CABANG") {
        return NextResponse.redirect(new URL("/cabang", req.url));
      }

      // selain itu (misal SISWA) ke /siswa
      return NextResponse.redirect(new URL("/siswa", req.url));
    }

    // =========================
    // /siswa => SISWA
    // =========================
    if (protectedSiswa) {
      if (session.role === "SISWA") return NextResponse.next();

      if (session.role === "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }

      if (session.role === "ADMIN_CABANG") {
        return NextResponse.redirect(new URL("/cabang", req.url));
      }

      return NextResponse.redirect(new URL("/login", req.url));
    }

    // =========================
    // /cabang atau /admin-cabang
    // =========================
    if (protectedCabang) {
      // (opsional) superadmin boleh masuk juga
      if (session.role === "SUPER_ADMIN" || session.role === "ADMIN_CABANG") {
        return NextResponse.next();
      }

      // siswa tidak boleh masuk cabang
      return NextResponse.redirect(new URL("/siswa", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/siswa/:path*",
    "/cabang/:path*",
    "/admin-cabang/:path*",
  ],
};
