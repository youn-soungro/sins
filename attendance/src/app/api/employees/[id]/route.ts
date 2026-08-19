/** 직원 상세 조회 / 수정 / 삭제(퇴사처리) */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireAdmin, str } from '@/lib/api';
import { hashPassword, normalizePhone } from '@/lib/auth';
import { pickAuditFields, writeAudit } from '@/lib/audit';
import { dateOnly } from '@/lib/time';

const AUDIT_FIELDS = [
  'empNo', 'name', 'phone', 'hireDate', 'resignDate', 'status',
  'jobType', 'bankName', 'bankAccount', 'memo',
] as const;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const emp = await prisma.employee.findUnique({
      where: { id },
      include: {
        payRates: { orderBy: { effectiveFrom: 'desc' } },
        user: { select: { loginId: true, isActive: true, lastLoginAt: true } },
      },
    });
    if (!emp) return fail('직원을 찾을 수 없습니다.', 404);
    return ok(emp);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json();

    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) return fail('직원을 찾을 수 없습니다.', 404);

    const phone = b.phone !== undefined ? normalizePhone(String(b.phone)) : undefined;
    if (phone !== undefined && phone.length < 10) {
      return fail('휴대폰번호를 정확히 입력해 주세요.');
    }

    const after = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id },
        data: {
          ...(b.empNo !== undefined ? { empNo: String(b.empNo).trim() } : {}),
          ...(b.name !== undefined ? { name: String(b.name).trim() } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(b.hireDate !== undefined ? { hireDate: dateOnly(String(b.hireDate)) } : {}),
          ...(b.resignDate !== undefined
            ? { resignDate: b.resignDate ? dateOnly(String(b.resignDate)) : null }
            : {}),
          ...(b.status !== undefined ? { status: b.status } : {}),
          ...(b.jobType !== undefined ? { jobType: str(b.jobType) } : {}),
          ...(b.bankName !== undefined ? { bankName: str(b.bankName) } : {}),
          ...(b.bankAccount !== undefined ? { bankAccount: str(b.bankAccount) } : {}),
          ...(b.memo !== undefined ? { memo: str(b.memo) } : {}),
        },
      });

      // 로그인 계정도 함께 맞춘다.
      if (emp.userId) {
        await tx.user.update({
          where: { id: emp.userId },
          data: {
            ...(phone !== undefined ? { loginId: phone } : {}),
            ...(b.name !== undefined ? { name: String(b.name).trim() } : {}),
            ...(b.status !== undefined ? { isActive: b.status !== 'RESIGNED' } : {}),
            ...(str(b.pin) ? { passwordHash: await hashPassword(str(b.pin)!) } : {}),
          },
        });
      }
      return emp;
    });

    await writeAudit(admin, {
      entity: 'employees',
      entityId: id,
      action: 'UPDATE',
      before: pickAuditFields(before, [...AUDIT_FIELDS]),
      after: pickAuditFields(after, [...AUDIT_FIELDS]),
      reason: str(b.reason),
      ip: clientIp(req),
    });

    return ok(after);
  } catch (e) {
    return handleError(e);
  }
}

/**
 * 기본은 "퇴사처리"(소프트 삭제)다.
 * 근무·급여 기록 보존을 위해 완전삭제는 기록이 전혀 없는 경우에만 허용한다.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const hard = req.nextUrl.searchParams.get('hard') === '1';

    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return fail('직원을 찾을 수 없습니다.', 404);

    if (hard) {
      const attCount = await prisma.attendance.count({ where: { employeeId: id } });
      const payCount = await prisma.payroll.count({ where: { employeeId: id } });
      if (attCount > 0 || payCount > 0) {
        return fail(
          `근무기록 ${attCount}건, 정산 ${payCount}건이 있어 완전삭제할 수 없습니다. 퇴사처리를 사용하세요.`,
          409,
        );
      }
      await prisma.$transaction(async (tx) => {
        await tx.employee.delete({ where: { id } });
        if (emp.userId) await tx.user.delete({ where: { id: emp.userId } });
      });
      await writeAudit(admin, {
        entity: 'employees',
        entityId: id,
        action: 'DELETE',
        before: pickAuditFields(emp, [...AUDIT_FIELDS]),
        ip: clientIp(req),
      });
      return ok({ deleted: true });
    }

    const resignDate = str(req.nextUrl.searchParams.get('resignDate'));
    const updated = await prisma.$transaction(async (tx) => {
      const e = await tx.employee.update({
        where: { id },
        data: {
          status: 'RESIGNED',
          resignDate: resignDate ? dateOnly(resignDate) : new Date(),
        },
      });
      if (e.userId) await tx.user.update({ where: { id: e.userId }, data: { isActive: false } });
      return e;
    });

    await writeAudit(admin, {
      entity: 'employees',
      entityId: id,
      action: 'RESIGN',
      before: pickAuditFields(emp, [...AUDIT_FIELDS]),
      after: pickAuditFields(updated, [...AUDIT_FIELDS]),
      ip: clientIp(req),
    });

    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
