import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { syncPayrollForDate } from '@/lib/payroll-service';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json();
    const before = await prisma.deduction.findUnique({ where: { id } });
    if (!before) return fail('공제 항목을 찾을 수 없습니다.', 404);
    if (b.reason !== undefined && !str(b.reason)) return fail('공제사유는 비울 수 없습니다.');

    const after = await prisma.deduction.update({
      where: { id },
      data: {
        ...(b.amount !== undefined ? { amount: num(b.amount) } : {}),
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.reason !== undefined ? { reason: str(b.reason)! } : {}),
      },
    });
    await syncPayrollForDate(after.employeeId, after.workDate);
    await writeAudit(admin, {
      entity: 'deductions', entityId: id, action: 'UPDATE', before, after, ip: clientIp(req),
    });
    return ok(after);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const before = await prisma.deduction.findUnique({ where: { id } });
    if (!before) return fail('공제 항목을 찾을 수 없습니다.', 404);
    await prisma.deduction.delete({ where: { id } });
    await syncPayrollForDate(before.employeeId, before.workDate);
    await writeAudit(admin, {
      entity: 'deductions', entityId: id, action: 'DELETE', before, ip: clientIp(req),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
