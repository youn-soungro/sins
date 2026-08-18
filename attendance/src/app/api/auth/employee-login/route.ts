/** 직원 로그인 — 휴대폰번호 + PIN */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createSessionToken,
  normalizePhone,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth';
import { clientIp, fail, handleError, ok, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = normalizePhone(str(body.phone) ?? '');
    const pin = str(body.pin);
    if (!phone || !pin) return fail('휴대폰번호와 PIN을 입력해 주세요.');

    const user = await prisma.user.findUnique({
      where: { loginId: phone },
      include: { employee: true },
    });
    if (!user || user.role !== 'EMPLOYEE' || !user.isActive || !user.employee) {
      return fail('등록되지 않은 번호이거나 PIN이 올바르지 않습니다.', 401);
    }
    if (user.employee.status === 'RESIGNED') {
      return fail('퇴사 처리된 계정입니다. 관리자에게 문의하세요.', 403);
    }
    if (!(await verifyPassword(pin, user.passwordHash))) {
      return fail('등록되지 않은 번호이거나 PIN이 올바르지 않습니다.', 401);
    }

    const session = {
      userId: user.id,
      loginId: user.loginId,
      name: user.name,
      role: user.role,
      employeeId: user.employee.id,
    };
    await setSessionCookie(await createSessionToken(session));
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(session, {
      entity: 'users',
      entityId: user.id,
      action: 'LOGIN',
      ip: clientIp(req),
    });

    return ok({ role: user.role, name: user.employee.name });
  } catch (e) {
    return handleError(e);
  }
}
