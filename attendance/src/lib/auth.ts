/**
 * Role 기반 인증. JWT 를 httpOnly 쿠키에 담아 세션을 유지한다.
 * 관리자: 아이디 + 비밀번호 / 직원: 휴대폰번호 + PIN
 */
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';

export const SESSION_COOKIE = 'sins_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14일

export interface SessionUser {
  userId: string;
  loginId: string;
  name: string;
  role: Role;
  /** 직원 계정인 경우의 employees.id */
  employeeId?: string | null;
}

function secretKey(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.userId || !payload.role) return null;
    return {
      userId: String(payload.userId),
      loginId: String(payload.loginId ?? ''),
      name: String(payload.name ?? ''),
      role: payload.role as Role,
      employeeId: payload.employeeId ? String(payload.employeeId) : null,
    };
  } catch {
    return null;
  }
}

/** 현재 로그인 사용자 (없으면 null) */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 휴대폰번호에서 숫자만 남긴다. */
export function normalizePhone(v: string): string {
  return (v || '').replace(/\D/g, '');
}

/** 010-1234-5678 형태로 표시 */
export function formatPhone(v: string): string {
  const d = normalizePhone(v);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return v;
}
