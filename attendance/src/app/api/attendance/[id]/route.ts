/**
 * 출퇴근 기록 관리자 수정.
 * 수정 전/후 값과 사유를 반드시 audit_logs 에 남긴다.
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { kstLocalInputToUtc } from '@/lib/time';
import { recalcAttendance, syncAutoAllowances } from '@/lib/attendance-service';
import { syncPayrollForDate } from '@/lib/payroll-service';

const SNAPSHOT = (a: Record<string, unknown>) => ({
  checkInAt: a.checkInAt instanceof Date ? a.checkInAt.toISOString() : a.checkInAt,
  checkOutAt: a.checkOutAt instanceof Date ? a.checkOutAt.toISOString() : a.checkOutAt,
  workplaceId: a.workplaceId,
  projectId: a.projectId,
  workType: a.workType,
  status: a.status,
  actualMinutes: a.actualMinutes,
  overtimeMinutes: a.overtimeMinutes,
  dayTotalPay: a.dayTotalPay,
  adminMemo: a.adminMemo,
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const att = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: true,
        workplace: true,
        project: true,
        breaks: { orderBy: { startAt: 'asc' } },
        allowances: true,
        editRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!att) return fail('기록을 찾을 수 없습니다.', 404);
    return ok(att);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json();

    const reason = str(b.reason);
    if (!reason) return fail('수정사유를 입력해 주세요. (이력 보존을 위해 필수입니다)');

    const before = await prisma.attendance.findUnique({ where: { id } });
    if (!before) return fail('기록을 찾을 수 없습니다.', 404);

    const checkInAt = b.checkInAt !== undefined ? kstLocalInputToUtc(String(b.checkInAt)) : undefined;
    const checkOutAt = b.checkOutAt !== undefined
      ? b.checkOutAt ? kstLocalInputToUtc(String(b.checkOutAt)) : null
      : undefined;

    const nextIn = checkInAt !== undefined ? checkInAt : before.checkInAt;
    const nextOut = checkOutAt !== undefined ? checkOutAt : before.checkOutAt;
    if (nextIn && nextOut && nextOut <= nextIn) {
      return fail('퇴근시간은 출근시간보다 늦어야 합니다.');
    }

    await prisma.attendance.update({
      where: { id },
      data: {
        ...(checkInAt !== undefined ? { checkInAt } : {}),
        ...(checkOutAt !== undefined ? { checkOutAt } : {}),
        ...(b.workplaceId !== undefined ? { workplaceId: str(b.workplaceId) } : {}),
        ...(b.projectId !== undefined ? { projectId: str(b.projectId) } : {}),
        ...(b.workType !== undefined ? { workType: b.workType } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.isHoliday !== undefined ? { isHoliday: !!b.isHoliday } : {}),
        ...(b.adminMemo !== undefined ? { adminMemo: str(b.adminMemo) } : {}),
        // 퇴근시간을 채워 넣으면 자동마감 표시를 해제한다.
        ...(checkOutAt ? { isAutoClosed: false, status: 'DONE' as const } : {}),
      },
    });

    // 근무지 구분이 바뀌면 단가·고정수당도 다시 맞춘다.
    if (b.workType !== undefined || b.workplaceId !== undefined) {
      await syncAutoAllowances(id);
    }
    const after = await recalcAttendance(id);
    await syncPayrollForDate(after.employeeId, after.workDate);

    await writeAudit(admin, {
      entity: 'attendance',
      entityId: id,
      action: 'UPDATE',
      before: SNAPSHOT(before as unknown as Record<string, unknown>),
      after: SNAPSHOT(after as unknown as Record<string, unknown>),
      reason,
      ip: clientIp(req),
    });

    return ok(after);
  } catch (e) {
    return handleError(e);
  }
}

/** 결근/휴무 등으로 기록을 되돌린다. 삭제 대신 상태 변경 + 이력 보존. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const reason = str(req.nextUrl.searchParams.get('reason'));
    if (!reason) return fail('삭제사유를 입력해 주세요.');

    const before = await prisma.attendance.findUnique({ where: { id } });
    if (!before) return fail('기록을 찾을 수 없습니다.', 404);

    await prisma.attendance.delete({ where: { id } });
    await writeAudit(admin, {
      entity: 'attendance',
      entityId: id,
      action: 'DELETE',
      before: SNAPSHOT(before as unknown as Record<string, unknown>),
      reason,
      ip: clientIp(req),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
