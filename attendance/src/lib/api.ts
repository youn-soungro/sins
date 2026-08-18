/** API 라우트 공통 헬퍼 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, type SessionUser } from './auth';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** 예외를 일관된 JSON 응답으로 변환한다. */
export function handleError(e: unknown) {
  if (e instanceof ApiError) return fail(e.message, e.status, e.extra);
  const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
  console.error('[api]', e);
  // Prisma 고유 제약 위반 등 자주 나오는 오류를 한국어로 안내한다.
  if (msg.includes('Unique constraint')) {
    return fail('이미 등록된 값입니다. 중복 여부를 확인해 주세요.', 409);
  }
  return fail(msg, 500);
}

/** 관리자만 통과 */
export async function requireAdmin(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new ApiError('로그인이 필요합니다.', 401);
  if (s.role !== 'ADMIN') throw new ApiError('관리자 권한이 필요합니다.', 403);
  return s;
}

/** 로그인한 사용자면 통과 */
export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new ApiError('로그인이 필요합니다.', 401);
  return s;
}

/** 직원 본인 계정만 통과 (관리자는 employeeId 파라미터로 대리 조회 가능) */
export async function requireEmployee(): Promise<SessionUser & { employeeId: string }> {
  const s = await requireUser();
  if (s.role !== 'EMPLOYEE' || !s.employeeId) {
    throw new ApiError('직원 계정으로 로그인해 주세요.', 403);
  }
  return s as SessionUser & { employeeId: string };
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export function userAgent(req: NextRequest): string {
  return (req.headers.get('user-agent') ?? 'unknown').slice(0, 300);
}

/** 숫자 파라미터 파싱 */
export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
