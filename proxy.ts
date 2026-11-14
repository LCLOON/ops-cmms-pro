import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// In Next.js 16 the middleware convention is `proxy.ts` (same capability).
//
// The forced-password-change gate is enforced on the client (AppShell renders
// only the change-password screen) AND here, because a client-side gate alone
// is bypassable by calling the API directly with a valid cookie. Seeded
// accounts carry published credentials, so the window between first login and
// password rotation must not expose maintenance or compliance data.
//
// Cookie name mirrors SESSION_COOKIE in lib/auth.ts. It is duplicated rather
// than imported because importing that module pulls in server-only helpers
// that are not available in the proxy runtime.

const SESSION_COOKIE = 'oc_session';

// Everything under /api/auth must stay reachable, otherwise a gated user could
// never change their password or sign out.
const ALLOWED_PREFIXES = ['/api/auth/'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (ALLOWED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.JWT_SECRET;
  // No token or no secret: let the route handler produce its own 401. Sessions
  // cannot be minted without the secret, so there is nothing to gate here.
  if (!token || !secret) return NextResponse.next();

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (payload.forcePasswordChange === true) {
      return NextResponse.json(
        { error: 'Password change required before using this endpoint', code: 'PASSWORD_CHANGE_REQUIRED' },
        { status: 403 },
      );
    }
  } catch {
    // Invalid or expired token: the route's own guard returns 401.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
