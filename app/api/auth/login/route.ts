import { NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { createSession, sessionCookieOptions } from '@/lib/auth';
import { seedDatabase, getUserByUsername, updateLastLogin } from '@/lib/operations';
import { loginSchema } from '@/lib/validations';
import { headers } from 'next/headers';

function getClientIp(hdrs: Headers): string {
  return hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || '';
}

const LOGIN_ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = LOGIN_ATTEMPTS.get(ip);
  if (!entry || entry.resetAt < now) { LOGIN_ATTEMPTS.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return { allowed: true }; }
  if (entry.count >= MAX_ATTEMPTS) return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  entry.count++; return { allowed: true };
}

export async function POST(request: Request) {
  try {
    seedDatabase();
    const hdrs = await headers();
    const ip = getClientIp(hdrs) || 'unknown';

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rateCheck.retryAfterSec}s.` }, { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSec) } });
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });

    const { password } = parsed.data;
    const username = parsed.data.username?.trim().toLowerCase();
    if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 });

    const user = getUserByUsername(username);
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const valid = bcryptjs.compareSync(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    updateLastLogin(user.id);
    const session = { userId: user.id, username: user.username, displayName: user.display_name, role: user.role as 'admin' | 'manager' | 'technician' | 'viewer' };
    const token = await createSession(session);
    const cookie = sessionCookieOptions(token);

    const response = NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role, forcePasswordChange: !!user.force_password_change } });
    response.cookies.set(cookie);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
