/** 관리자 대시보드 집계 */
import { prisma } from './prisma';
import { getWorkSettings } from './settings';
import { calcWorkTime } from './payroll';
import { todayDateOnly } from './time';

export async function getTodayOverview() {
  const workDate = todayDateOnly();
  const settings = await getWorkSettings();

  const [employees, attendances] = await Promise.all([
    prisma.employee.findMany({
      where: { status: { in: ['ACTIVE', 'LEAVE'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, jobType: true, status: true, phone: true },
    }),
    prisma.attendance.findMany({
      where: { workDate },
      include: { breaks: true, workplace: true, project: true, employee: true },
    }),
  ]);

  const byEmployee = new Map(attendances.map((a) => [a.employeeId, a]));

  const cards = employees.map((e) => {
    const a = byEmployee.get(e.id);
    if (!a || !a.checkInAt) {
      return {
        employeeId: e.id,
        name: e.name,
        jobType: e.jobType,
        state: 'NOT_CHECKED_IN' as const,
        checkIn: null as Date | null,
        checkOut: null as Date | null,
        workplaceName: null as string | null,
        workType: null as string | null,
        liveMinutes: 0,
        overtimeMinutes: 0,
        isLate: false,
        dayTotalPay: 0,
        attendanceId: null as string | null,
      };
    }
    const live = calcWorkTime(a.checkInAt, a.checkOutAt, a.breaks, settings);
    const onBreak = a.breaks.some((b) => !b.endAt);
    return {
      employeeId: e.id,
      name: e.name,
      jobType: e.jobType,
      state: a.checkOutAt ? ('DONE' as const) : onBreak ? ('ON_BREAK' as const) : ('WORKING' as const),
      checkIn: a.checkInAt,
      checkOut: a.checkOutAt,
      workplaceName: a.project?.name ?? a.workplace?.name ?? null,
      workType: a.workType,
      liveMinutes: live.actualMinutes,
      overtimeMinutes: live.overtimeMinutes,
      isLate: a.isLate,
      dayTotalPay: a.dayTotalPay,
      attendanceId: a.id,
    };
  });

  const working = cards.filter((c) => c.state === 'WORKING' || c.state === 'ON_BREAK');
  const done = cards.filter((c) => c.state === 'DONE');
  const notIn = cards.filter((c) => c.state === 'NOT_CHECKED_IN');

  return {
    workDate,
    totalEmployees: employees.length,
    checkedIn: working.length,
    checkedOut: done.length,
    notCheckedIn: notIn.length,
    factoryCount: cards.filter((c) => c.workType === 'FACTORY' && c.state !== 'NOT_CHECKED_IN').length,
    siteCount: cards.filter((c) => c.workType === 'SITE' && c.state !== 'NOT_CHECKED_IN').length,
    lateCount: cards.filter((c) => c.isLate).length,
    overtimeCount: cards.filter((c) => c.overtimeMinutes > 0).length,
    estimatedCost: cards.reduce((s, c) => s + c.dayTotalPay, 0),
    cards,
  };
}
