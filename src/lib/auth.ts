import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = "spp_session";

export type SessionRole = "SUPER_ADMIN" | "SISWA" | "ADMIN_CABANG";

export type SessionPayload = {
  uid: string;
  role: SessionRole;

  // ✅ tetap dipakai untuk login siswa / user lama
  studentId: string | null;

  // ✅ username tetap
  username: string;

  // ✅ tambahan untuk admin cabang (optional biar gak ganggu sistem lama)
  branch_id?: string | null;
  name?: string | null;
};

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as SessionPayload;
}
