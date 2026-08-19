/** 직원 본인의 현재 근무상태 조회 (진행중이면 실시간 근무시간 포함) */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError, ok, requireUser, str, ApiError } from '@/lib/api';
import { getWorkSettings } from '@/lib/settings';
import { calcWorkTime } from '@/lib/payroll';
import { kstDateStr, kstTimeStr, todayDateOnly } from '@/lib/time';

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const employeeId =
      session.role === 'ADMIN'
        ? str(req.nextUrl.searchParams.get('employeeId'))
        : session.employeeId ?? null;
    if (!employeeId) throw new ApiError('직원 정보를 찾을 수 없습니다.', 400);

    let att = await prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId, workDate: todayDateOnly() } },
      include: {
        breaks: { orderBy: { startAt: 'asc' } },
        workplace: true,
        project: true,
        allowances: true,
      },
    });
    // 자정을 넘긴 야간근무 기록도 이어서 보여준다.
    if (!att) {
      att = await prisma.attendance.findFirst({
        where: { employeeId, checkOutAt: null, checkInAt: { not: null } },
        orderBy: { workDate: 'desc' },
        include: {
          breaks: { orderBy: { startAt: 'asc' } },
          workplace: true,
          project: true,
          allowances: true,
        },
      });
    }

    if (!att || !att.checkInAt) {
      return ok({ state: 'NOT_CHECKED_IN', today: kstDateStr(), attendance: null });
    }

    const settings = await getWorkSettings();
    const live = calcWorkTime(att.checkInAt, att.checkOutAt, att.breaks, settings);
    const onBreak = att.breaks.some((b) => !b.endAt);

    return ok({
      state: att.checkOutAt ? 'DONE' : onBreak ? 'ON_BREAK' : 'WORKING',
      today: kstDateStr(),
      attendance: {
        id: att.id,
        workDate: kstDateStr(att.checkInAt),
        checkIn: kstTimeStr(att.checkInAt),
        checkOut: att.checkOutAt ? kstTimeStr(att.checkOutAt) : null,
        workplaceName: att.workplace?.name ?? null,
        projectName: att.project?.name ?? null,
        workType: att.workType,
        isLate: att.isLate,
        breaks: att.breaks.map((b) => ({
          id: b.id,
          start: kstTimeStr(b.startAt),
          end: b.endAt ? kstTimeStr(b.endAt) : null,
          minutes: b.minutes,
        })),
        live,
        pay: {
          basePay: att.basePay,
          overtimePay: att.overtimePay,
          allowanceTotal: att.allowanceTotal,
          dayTotalPay: att.dayTotalPay,
        },
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
