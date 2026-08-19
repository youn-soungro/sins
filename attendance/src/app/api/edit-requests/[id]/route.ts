/** 수정요청 승인 / 반려 (관리자) */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { recalcAttendance } from '@/lib/attendance-service';
import { syncPayrollForDate } from '@/lib/payroll-service';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json();
    const action = str(b.action); // 'approve' | 'reject'

    const reqRow = await prisma.attendanceEditRequest.findUnique({
      where: { id },
      include: { attendance: true, employee: { select: { name: true } } },
    });
    if (!reqRow) return fail('수정요청을 찾을 수 없습니다.', 404);
    if (reqRow.status !== 'PENDING') return fail('이미 처리된 요청입니다.', 409);

    if (action === 'reject') {
      const rejected = await prisma.attendanceEditRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy: admin.name,
          reviewedAt: new Date(),
          reviewMemo: str(b.reviewMemo),
        },
      });
      await writeAudit(admin, {
        entity: 'attendance_edit_requests', entityId: id, action: 'REJECT',
        after: { reviewMemo: rejected.reviewMemo }, reason: str(b.reviewMemo), ip: clientIp(req),
      });
      return ok(rejected);
    }

    if (action !== 'approve') return fail("action 은 'approve' 또는 'reject' 여야 합니다.");

    const nextIn = reqRow.requestCheckIn ?? reqRow.attendance.checkInAt;
    const nextOut = reqRow.requestCheckOut ?? reqRow.attendance.checkOutAt;
    if (nextIn && nextOut && nextOut <= nextIn) {
      return fail('요청된 퇴근시간이 출근시간보다 빠릅니다. 반려하거나 관리자가 직접 수정해 주세요.');
    }

    const before = {
      checkInAt: reqRow.attendance.checkInAt?.toISOString() ?? null,
      checkOutAt: reqRow.attendance.checkOutAt?.toISOString() ?? null,
      actualMinutes: reqRow.attendance.actualMinutes,
      dayTotalPay: reqRow.attendance.dayTotalPay,
    };

    await prisma.attendance.update({
      where: { id: reqRow.attendanceId },
      data: {
        ...(reqRow.requestCheckIn ? { checkInAt: reqRow.requestCheckIn } : {}),
        ...(reqRow.requestCheckOut
          ? { checkOutAt: reqRow.requestCheckOut, status: 'DONE' as const, isAutoClosed: false }
          : {}),
        adminMemo: [
          reqRow.attendance.adminMemo,
          `수정요청 승인 (${admin.name}) — 사유: ${reqRow.reason}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });
    const after = await recalcAttendance(reqRow.attendanceId);
    await syncPayrollForDate(after.employeeId, after.workDate);

    const approved = await prisma.attendanceEditRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: admin.name,
        reviewedAt: new Date(),
        reviewMemo: str(b.reviewMemo),
      },
    });

    // 승인에 따른 실제 기록 변경도 별도로 남긴다.
    await writeAudit(admin, {
      entity: 'attendance',
      entityId: reqRow.attendanceId,
      action: 'UPDATE_BY_REQUEST',
      before,
      after: {
        checkInAt: after.checkInAt?.toISOString() ?? null,
        checkOutAt: after.checkOutAt?.toISOString() ?? null,
        actualMinutes: after.actualMinutes,
        dayTotalPay: after.dayTotalPay,
      },
      reason: `수정요청 승인 — ${reqRow.reason}`,
      ip: clientIp(req),
    });
    await writeAudit(admin, {
      entity: 'attendance_edit_requests', entityId: id, action: 'APPROVE',
      after: { reviewedBy: admin.name }, ip: clientIp(req),
    });

    return ok(approved);
  } catch (e) {
    return handleError(e);
  }
}
