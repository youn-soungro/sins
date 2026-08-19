/** 추가수당 목록 / 등록 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { dateOnly } from '@/lib/time';
import { recalcAttendance } from '@/lib/attendance-service';
import { syncPayrollForDate } from '@/lib/payroll-service';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const from = str(sp.get('from'));
    const to = str(sp.get('to'));
    const employeeId = str(sp.get('employeeId'));

    const rows = await prisma.allowance.findMany({
      where: {
        ...(employeeId && employeeId !== 'ALL' ? { employeeId } : {}),
        ...(from || to
          ? { workDate: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } }
          : {}),
      },
      include: {
        employee: { select: { name: true, empNo: true } },
        project: { select: { name: true } },
      },
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
    if (!employeeId) return fail('직원을 선택해 주세요.');
    if (!amount) return fail('금액을 입력해 주세요.');

    const workDate = str(b.workDate) ? dateOnly(str(b.workDate)!) : new Date();

    // 같은 날 출퇴근 기록이 있으면 연결해 당일 지급액에 반영한다.
    const att = await prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId, workDate } },
    });

    const created = await prisma.allowance.create({
      data: {
        employeeId,
        attendanceId: att?.id ?? null,
        projectId: str(b.projectId) ?? att?.projectId ?? null,
        workDate,
        type: (str(b.type) as never) ?? 'ETC',
        amount,
        memo: str(b.memo),
        isAuto: false,
        createdBy: admin.name,
      },
    });
    if (att) await recalcAttendance(att.id);
    await syncPayrollForDate(employeeId, workDate);

    await writeAudit(admin, {
      entity: 'allowances', entityId: created.id, action: 'CREATE', after: created, ip: clientIp(req),
    });
    return ok(created);
  } catch (e) {
    return handleError(e);
  }
}
