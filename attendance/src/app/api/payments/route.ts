/** 지급 등록 / 조회 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { refreshPayrollPaymentState } from '@/lib/payroll-service';
import { kstLocalInputToUtc } from '@/lib/time';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const payrollId = str(sp.get('payrollId'));
    const rows = await prisma.payment.findMany({
      where: payrollId ? { payrollId } : {},
      include: {
        payroll: {
          include: { employee: { select: { name: true, empNo: true, bankName: true, bankAccount: true } } },
        },
      },
      orderBy: { paidAt: 'desc' },
      take: 500,
    });
    return ok(rows);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const b = await req.json();
    const payrollId = str(b.payrollId);
    const amount = num(b.amount);
    if (!payrollId) return fail('정산을 선택해 주세요.');
    if (amount <= 0) return fail('지급금액을 입력해 주세요.');

    const payroll = await prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { payments: true, employee: { select: { name: true } } },
    });
    if (!payroll) return fail('정산 정보를 찾을 수 없습니다.', 404);

    const alreadyPaid = payroll.payments.reduce((s, p) => s + p.amount, 0);
    if (alreadyPaid + amount > payroll.netTotal) {
      return fail(
        `지급 합계가 최종 지급액을 초과합니다. (남은 금액 ${(payroll.netTotal - alreadyPaid).toLocaleString('ko-KR')}원)`,
      );
    }

    const created = await prisma.payment.create({
      data: {
        payrollId,
        amount,
        paidAt: str(b.paidAt) ? kstLocalInputToUtc(String(b.paidAt)) ?? new Date() : new Date(),
        method: (str(b.method) as never) ?? 'TRANSFER',
        memo: str(b.memo),
        createdBy: admin.name,
      },
    });
    const refreshed = await refreshPayrollPaymentState(payrollId);

    await writeAudit(admin, {
      entity: 'payments', entityId: created.id, action: 'CREATE',
      after: { employee: payroll.employee.name, amount, method: created.method },
      ip: clientIp(req),
    });
    return ok({ payment: created, payroll: refreshed });
  } catch (e) {
    return handleError(e);
  }
}
