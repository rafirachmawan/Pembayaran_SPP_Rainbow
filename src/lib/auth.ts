import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = "spp_session";

export type SessionPayload = {
  uid: string;
  role: "SUPER_ADMIN" | "SISWA";
  studentId: string | null;
  username: string;
};

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as SessionPayload;
}
