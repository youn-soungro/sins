/**
 * 퇴근.
 *  - 열려있는 휴게가 있으면 함께 종료한다.
 *  - 근무시간 / 일당 / 연장수당을 계산해 저장하고 결과를 돌려준다.
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireUser, str, userAgent, ApiError } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { verifyLocation } from '@/lib/geo';
import { kstTimeStr, todayDateOnly, minutesToKorean } from '@/lib/time';
import { recalcAttendance } from '@/lib/attendance-service';

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const b = await req.json();

    const employeeId = session.role === 'ADMIN' ? str(b.employeeId) : session.employeeId ?? null;
    if (!employeeId) throw new ApiError('직원 정보를 찾을 수 없습니다.', 400);

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return fail('직원을 찾을 수 없습니다.', 404);

    // 오늘 기록이 없으면 자정을 넘긴 야간근무일 수 있으므로 미퇴근 기록을 찾는다.
    let att = await prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId, workDate: todayDateOnly() } },
      include: { breaks: true },
    });
    if (!att || !att.checkInAt) {
      att = await prisma.attendance.findFirst({
        where: { employeeId, checkOutAt: null, checkInAt: { not: null } },
        orderBy: { workDate: 'desc' },
        include: { breaks: true },
      });
    }
    if (!att || !att.checkInAt) return fail('출근 기록이 없습니다. 먼저 출근해 주세요.', 400);
    if (att.checkOutAt) {
      return fail(`이미 ${kstTimeStr(att.checkOutAt)}에 퇴근 처리되었습니다.`, 409);
    }

    const nowAt = new Date();
    if (nowAt <= att.checkInAt) return fail('퇴근시간이 출근시간보다 빠릅니다.', 400);

    // 열려있는 휴게 종료
    for (const br of att.breaks) {
      if (!br.endAt) {
        await prisma.breakLog.update({
          where: { id: br.id },
          data: {
            endAt: nowAt,
            minutes: Math.max(0, Math.floor((nowAt.getTime() - br.startAt.getTime()) / 60000)),
          },
        });
      }
    }

    const workplace = att.workplaceId
      ? await prisma.workplace.findUnique({ where: { id: att.workplaceId } })
      : null;
    const lat = b.lat != null && b.lat !== '' ? Number(b.lat) : null;
    const lng = b.lng != null && b.lng !== '' ? Number(b.lng) : null;
    const verdict = verifyLocation(lat, lng, workplace);

    await prisma.attendance.update({
      where: { id: att.id },
      data: {
        checkOutAt: nowAt,
        status: 'DONE',
        checkOutLat: lat,
        checkOutLng: lng,
        checkOutDistanceM: verdict.distanceM,
        checkOutGps: verdict.status,
        checkOutIp: clientIp(req),
        checkOutDevice: userAgent(req),
      },
    });

    const result = await recalcAttendance(att.id);

    await writeAudit(session, {
      entity: 'attendance',
      entityId: att.id,
      action: 'CHECK_OUT',
      before: { checkOutAt: null },
      after: {
        employee: employee.name,
        checkOutAt: nowAt.toISOString(),
        actualMinutes: result.actualMinutes,
        dayTotalPay: result.dayTotalPay,
      },
      ip: clientIp(req),
    });

    await notify({
      type: 'CHECK_OUT',
      title: '퇴근',
      body: `${employee.name}님이 ${kstTimeStr(nowAt)} 퇴근했습니다.`,
      employeeId,
    });

    if (result.overtimeMinutes > 0) {
      await notify({
        type: 'OVERTIME',
        title: '연장근무',
        body: `${employee.name}님 연장근무 ${minutesToKorean(result.overtimeMinutes)}.`,
        employeeId,
      });
    }

    return ok({
      attendanceId: result.id,
      checkIn: kstTimeStr(result.checkInAt),
      checkOut: kstTimeStr(result.checkOutAt),
      totalMinutes: result.totalMinutes,
      breakMinutes: result.breakMinutes,
      actualMinutes: result.actualMinutes,
      normalMinutes: result.normalMinutes,
      overtimeMinutes: result.overtimeMinutes,
      basePay: result.basePay,
      overtimePay: result.overtimePay,
      allowanceTotal: result.allowanceTotal,
      dayTotalPay: result.dayTotalPay,
    });
  } catch (e) {
    return handleError(e);
  }
}
