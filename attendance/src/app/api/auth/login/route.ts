/** 관리자 로그인 — 아이디 + 비밀번호 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, setSessionCookie, verifyPassword } from '@/lib/auth';
import { clientIp, fail, handleError, ok, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loginId = str(body.loginId);
    const password = str(body.password);
    if (!loginId || !password) return fail('아이디와 비밀번호를 입력해 주세요.');

    const user = await prisma.user.findUnique({ where: { loginId } });
    if (!user || user.role !== 'ADMIN' || !user.isActive) {
      return fail('아이디 또는 비밀번호가 올바르지 않습니다.', 401);
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return fail('아이디 또는 비밀번호가 올바르지 않습니다.', 401);
    }

    const session = {
      userId: user.id,
      loginId: user.loginId,
      name: user.name,
      role: user.role,
      employeeId: null,
    };
    await setSessionCookie(await createSessionToken(session));
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(session, {
      entity: 'users',
      entityId: user.id,
      action: 'LOGIN',
      ip: clientIp(req),
    });

    return ok({ role: user.role, name: user.name });
  } catch (e) {
    return handleError(e);
  }
}
