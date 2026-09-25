import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sends visitors without a session cookie to /login before a protected page renders.
 * This only checks that the cookie exists; the API validates it on every request, and the
 * pages send the user to /login if the API answers 401 (e.g. an expired session).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has('sid')) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except the login and terms pages, the API rewrite, and static files.
  matcher: ['/((?!login|terms|api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
};
