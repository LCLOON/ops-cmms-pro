import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { seedDatabase } from './operations';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET required in production'); })()
    : 'ops-cmms-dev-secret-do-not-use-in-production')
);

const SESSION_COOKIE = 'oc_session';
const SESSION_TTL = 8 * 60 * 60;

export interface SessionPayload {
  userId: number;
  username: string;
  displayName: string;
  role: 'admin' | 'manager' | 'technician' | 'viewer';
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(JWT_SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch { return null; }
}

export async function getSession(): Promise<SessionPayload | null> {
  seedDatabase();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL,
  };
}
