/**
 * 휴게 시작 / 종료.
 * 하루에 여러 번 휴게해도 모두 기록하며, 열려있는 휴게가 있으면 중복 시작을 막는다.
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireUser, str, ApiError } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { kstTimeStr, todayDateOnly } from '@/lib/time';
import { recalcAttendance } from '@/lib/attendance-service';

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const b = await req.json();
    const action = str(b.action); // 'start' | 'end'

    const employeeId = session.role === 'ADMIN' ? str(b.employeeId) : session.employeeId ?? null;
    if (!employeeId) throw new ApiError('직원 정보를 찾을 수 없습니다.', 400);

    let att = await prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId, workDate: todayDateOnly() } },
      include: { breaks: { orderBy: { startAt: 'desc' } } },
    });
    if (!att || !att.checkInAt) {
      att = await prisma.attendance.findFirst({
        where: { employeeId, checkOutAt: null, checkInAt: { not: null } },
        orderBy: { workDate: 'desc' },
        include: { breaks: { orderBy: { startAt: 'desc' } } },
      });
    }
    if (!att || !att.checkInAt) return fail('출근 기록이 없습니다. 먼저 출근해 주세요.', 400);
    if (att.checkOutAt) return fail('이미 퇴근 처리되어 휴게를 기록할 수 없습니다.', 409);

    const openBreak = att.breaks.find((x) => !x.endAt);
    const nowAt = new Date();

    if (action === 'start') {
      if (openBreak) {
        return fail(`이미 ${kstTimeStr(openBreak.startAt)}부터 휴게중입니다.`, 409);
      }
      const created = await prisma.breakLog.create({
        data: { attendanceId: att.id, startAt: nowAt, memo: str(b.memo) },
      });
      await prisma.attendance.update({ where: { id: att.id }, data: { status: 'ON_BREAK' } });
      await recalcAttendance(att.id);
      await writeAudit(session, {
        entity: 'breaks', entityId: created.id, action: 'BREAK_START',
        after: { attendanceId: att.id, startAt: nowAt.toISOString() }, ip: clientIp(req),
      });
      return ok({ breakId: created.id, startAt: kstTimeStr(nowAt), status: 'ON_BREAK' });
    }

    if (action === 'end') {
      if (!openBreak) return fail('진행중인 휴게가 없습니다.', 409);
      if (nowAt <= openBreak.startAt) return fail('휴게 종료시간이 시작시간보다 빠릅니다.', 400);

      const minutes = Math.max(0, Math.floor((nowAt.getTime() - openBreak.startAt.getTime()) / 60000));
      await prisma.breakLog.update({
        where: { id: openBreak.id },
        data: { endAt: nowAt, minutes },
      });
      await prisma.attendance.update({ where: { id: att.id }, data: { status: 'WORKING' } });
      const result = await recalcAttendance(att.id);
      await writeAudit(session, {
        entity: 'breaks', entityId: openBreak.id, action: 'BREAK_END',
        after: { endAt: nowAt.toISOString(), minutes }, ip: clientIp(req),
      });
      return ok({
        breakId: openBreak.id,
        endAt: kstTimeStr(nowAt),
        minutes,
        totalBreakMinutes: result.breakMinutes,
        status: 'WORKING',
      });
    }

    return fail("action 은 'start' 또는 'end' 여야 합니다.");
  } catch (e) {
    return handleError(e);
  }
}
