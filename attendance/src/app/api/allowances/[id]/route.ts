import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { recalcAttendance } from '@/lib/attendance-service';
import { syncPayrollForDate } from '@/lib/payroll-service';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json();
    const before = await prisma.allowance.findUnique({ where: { id } });
    if (!before) return fail('수당 항목을 찾을 수 없습니다.', 404);

    const after = await prisma.allowance.update({
      where: { id },
      data: {
        ...(b.amount !== undefined ? { amount: num(b.amount) } : {}),
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.memo !== undefined ? { memo: str(b.memo) } : {}),
        isAuto: false, // 손으로 고친 항목은 자동 재생성 대상에서 제외
      },
    });
    if (after.attendanceId) await recalcAttendance(after.attendanceId);
    await syncPayrollForDate(after.employeeId, after.workDate);
    await writeAudit(admin, {
      entity: 'allowances', entityId: id, action: 'UPDATE', before, after,
      reason: str(b.reason), ip: clientIp(req),
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
    const before = await prisma.allowance.findUnique({ where: { id } });
    if (!before) return fail('수당 항목을 찾을 수 없습니다.', 404);

    await prisma.allowance.delete({ where: { id } });
    if (before.attendanceId) await recalcAttendance(before.attendanceId);
    await syncPayrollForDate(before.employeeId, before.workDate);
    await writeAudit(admin, {
      entity: 'allowances', entityId: id, action: 'DELETE', before, ip: clientIp(req),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
