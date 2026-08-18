import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { refreshPayrollPaymentState } from '@/lib/payroll-service';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const before = await prisma.payment.findUnique({ where: { id } });
    if (!before) return fail('지급 기록을 찾을 수 없습니다.', 404);

    await prisma.payment.delete({ where: { id } });
    const refreshed = await refreshPayrollPaymentState(before.payrollId);
    await writeAudit(admin, {
      entity: 'payments', entityId: id, action: 'DELETE', before,
      reason: str(req.nextUrl.searchParams.get('reason')), ip: clientIp(req),
    });
    return ok({ deleted: true, payroll: refreshed });
  } catch (e) {
    return handleError(e);
  }
}
