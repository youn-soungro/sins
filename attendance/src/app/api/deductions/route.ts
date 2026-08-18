/** 공제 목록 / 등록 — 공제사유는 필수 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { dateOnly } from '@/lib/time';
import { syncPayrollForDate } from '@/lib/payroll-service';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const from = str(sp.get('from'));
    const to = str(sp.get('to'));
    const employeeId = str(sp.get('employeeId'));

    const rows = await prisma.deduction.findMany({
      where: {
        ...(employeeId && employeeId !== 'ALL' ? { employeeId } : {}),
        ...(from || to
          ? { workDate: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } }
          : {}),
      },
      include: { employee: { select: { name: true, empNo: true } } },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
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
    const employeeId = str(b.employeeId);
    const amount = num(b.amount);
    const reason = str(b.reason);

    if (!employeeId) return fail('직원을 선택해 주세요.');
    if (!amount) return fail('공제금액을 입력해 주세요.');
    if (!reason) return fail('공제사유를 반드시 입력해 주세요.');

    const created = await prisma.deduction.create({
      data: {
        employeeId,
        workDate: str(b.workDate) ? dateOnly(str(b.workDate)!) : new Date(),
        type: (str(b.type) as never) ?? 'ETC',
        amount,
        reason,
        createdBy: admin.name,
      },
    });
    await syncPayrollForDate(created.employeeId, created.workDate);
    await writeAudit(admin, {
      entity: 'deductions', entityId: created.id, action: 'CREATE', after: created, ip: clientIp(req),
    });
    return ok(created);
  } catch (e) {
    return handleError(e);
  }
}
