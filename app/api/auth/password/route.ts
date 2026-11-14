import { NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { getSession, createSession, sessionCookieOptions } from '@/lib/auth';
import { getUserByUsername, changeUserPassword } from '@/lib/operations';

// Lets a signed-in user replace their own password. This is the only way out of
// the forced-password-change gate, so it must stay available to any role.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown } | null;
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
    }
    // A weak replacement would defeat the point of forcing the change.
    if (newPassword.length < 12) {
      return NextResponse.json({ error: 'New password must be at least 12 characters' }, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: 'New password must be different from the current password' }, { status: 400 });
    }

    const user = await getUserByUsername(session.username);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!bcryptjs.compareSync(currentPassword, user.password_hash)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    await changeUserPassword(user.id, newPassword);

    // Re-issue the session so the forcePasswordChange claim is cleared; without
    // this the user would stay gated until their token expired.
    const token = await createSession({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role as 'admin' | 'manager' | 'technician' | 'viewer',
      forcePasswordChange: false,
    });
    const response = NextResponse.json({ success: true });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (err) {
    console.error('[api/auth/password POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
