/** 직원이 자기 정산내역을 확인한다. 확인 시각을 저장한다. */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireEmployee, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee();
    const b = await req.json();
    const payrollId = str(b.payrollId);
    if (!payrollId) return fail('정산 정보를 찾을 수 없습니다.');

    const p = await prisma.payroll.findUnique({ where: { id: payrollId } });
    if (!p) return fail('정산 정보를 찾을 수 없습니다.', 404);
    if (p.employeeId !== session.employeeId) return fail('본인의 정산만 확인할 수 있습니다.', 403);
    if (!p.confirmedAt) return fail('아직 관리자가 정산을 확정하지 않았습니다.', 409);

    const updated = await prisma.payroll.update({
      where: { id: payrollId },
      data: { employeeConfirmedAt: p.employeeConfirmedAt ?? new Date() },
    });
    await writeAudit(session, {
      entity: 'payroll', entityId: payrollId, action: 'EMPLOYEE_CONFIRM',
      after: { employeeConfirmedAt: updated.employeeConfirmedAt?.toISOString() }, ip: clientIp(req),
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
