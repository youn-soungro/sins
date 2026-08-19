/**
 * Role 기반 접근 제어.
 * - /admin/**    : 관리자만
 * - /employee/** : 로그인한 사용자 (관리자도 화면 확인 가능)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith('/admin')) {
    if (!session) return redirectTo(req, '/login');
    if (session.role !== 'ADMIN') return redirectTo(req, '/employee');
  }

  if (pathname.startsWith('/employee') && pathname !== '/employee/login') {
    if (!session) return redirectTo(req, '/employee/login');
  }

  // 이미 로그인한 사용자가 로그인 화면에 오면 각자 홈으로 보낸다.
  if (session && (pathname === '/login' || pathname === '/employee/login')) {
    return redirectTo(req, session.role === 'ADMIN' ? '/admin' : '/employee');
  }

  return NextResponse.next();
}

function redirectTo(req: NextRequest, path: string) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/employee/:path*', '/login', '/employee/login'],
};
