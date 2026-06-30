import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/coach-dashboard',
  '/athlete-dashboard',
  '/scout-dashboard',
  '/analyst-dashboard',
  '/admin-dashboard',
  '/club-dashboard',
];

const AUTH_COOKIE_NAMES = [
  'firebaseToken',
  '__session',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const hasAuthCookie = AUTH_COOKIE_NAMES.some(name => request.cookies.has(name));
  const hasAuthHeader = request.headers.get('authorization')?.startsWith('Bearer ');

  if (!hasAuthCookie && !hasAuthHeader) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|login|register|$).*)',
  ],
};
