import { NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ success: true });
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null });
    return NextResponse.json({ user: { id: session.userId, username: session.username, displayName: session.displayName, role: session.role } });
  } catch {
    return NextResponse.json({ user: null });
  }
}
