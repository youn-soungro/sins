/**
 * 출퇴근 수정요청.
 * 직원은 기록을 직접 바꿀 수 없고 "수정 요청" 만 할 수 있다.
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireUser, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { kstLocalInputToUtc } from '@/lib/time';

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser();
    const status = str(req.nextUrl.searchParams.get('status'));

    const rows = await prisma.attendanceEditRequest.findMany({
      where: {
        // 직원은 본인 요청만 볼 수 있다.
        ...(session.role === 'EMPLOYEE' ? { employeeId: session.employeeId ?? '' } : {}),
        ...(status && status !== 'ALL' ? { status: status as never } : {}),
      },
      include: {
        employee: { select: { name: true, empNo: true } },
        attendance: {
          select: { workDate: true, checkInAt: true, checkOutAt: true, workType: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    });
    return ok(rows);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const b = await req.json();

    const attendanceId = str(b.attendanceId);
    const reason = str(b.reason);
    if (!attendanceId) return fail('수정할 근무기록을 선택해 주세요.');
    if (!reason) return fail('수정사유를 입력해 주세요.');

    const att = await prisma.attendance.findUnique({ where: { id: attendanceId } });
    if (!att) return fail('근무기록을 찾을 수 없습니다.', 404);

    // 직원은 본인 기록만 요청할 수 있다.
    if (session.role === 'EMPLOYEE' && att.employeeId !== session.employeeId) {
      return fail('본인의 근무기록만 수정요청할 수 있습니다.', 403);
    }

    const requestCheckIn = str(b.requestCheckIn)
      ? kstLocalInputToUtc(String(b.requestCheckIn))
      : null;
    const requestCheckOut = str(b.requestCheckOut)
      ? kstLocalInputToUtc(String(b.requestCheckOut))
      : null;
    if (!requestCheckIn && !requestCheckOut) {
      return fail('변경할 출근시간 또는 퇴근시간을 입력해 주세요.');
    }

    const dup = await prisma.attendanceEditRequest.findFirst({
      where: { attendanceId, status: 'PENDING' },
    });
    if (dup) return fail('이미 처리 대기중인 수정요청이 있습니다.', 409);

    const created = await prisma.attendanceEditRequest.create({
      data: {
        attendanceId,
        employeeId: att.employeeId,
        currentCheckIn: att.checkInAt,
        currentCheckOut: att.checkOutAt,
        requestCheckIn,
        requestCheckOut,
        reason,
      },
      include: { employee: { select: { name: true } } },
    });

    await writeAudit(session, {
      entity: 'attendance_edit_requests', entityId: created.id, action: 'CREATE',
      after: {
        attendanceId,
        requestCheckIn: requestCheckIn?.toISOString() ?? null,
        requestCheckOut: requestCheckOut?.toISOString() ?? null,
        reason,
      },
      ip: clientIp(req),
    });

    await notify({
      type: 'EDIT_REQUEST',
      title: '출퇴근 수정요청',
      body: `${created.employee.name}님이 출퇴근 시간 수정을 요청했습니다.`,
      employeeId: att.employeeId,
    });

    return ok(created);
  } catch (e) {
    return handleError(e);
  }
}
