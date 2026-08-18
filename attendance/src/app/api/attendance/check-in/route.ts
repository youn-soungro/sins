/**
 * 출근.
 *  - 중복 출근 방지 (직원+근무일 unique)
 *  - GPS 허용반경 검증 (반경 이탈 시 확인 후 진행 가능)
 *  - IP / 기기정보 기록
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireUser, str, userAgent, ApiError } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { verifyLocation } from '@/lib/geo';
import { getWorkSettings } from '@/lib/settings';
import { hhmmToMinutes } from '@/lib/payroll';
import { kstDateStr, kstParts, kstTimeStr, todayDateOnly } from '@/lib/time';
import { recalcAttendance, syncAutoAllowances } from '@/lib/attendance-service';

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const b = await req.json();

    // 관리자는 employeeId 를 지정해 대리 출근 처리를 할 수 있다.
    const employeeId =
      session.role === 'ADMIN' ? str(b.employeeId) : session.employeeId ?? null;
    if (!employeeId) throw new ApiError('직원 정보를 찾을 수 없습니다.', 400);

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return fail('직원을 찾을 수 없습니다.', 404);
    if (employee.status === 'RESIGNED') return fail('퇴사 처리된 직원입니다.', 403);

    const workDate = todayDateOnly();

    // ── 중복 출근 방지 ────────────────────────────
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_workDate: { employeeId, workDate } },
    });
    if (existing && existing.checkInAt) {
      return fail(
        `이미 ${kstTimeStr(existing.checkInAt)}에 출근 처리되었습니다.`,
        409,
        { attendanceId: existing.id },
      );
    }

    // ── 근무지 / 현장 ────────────────────────────
    const workplaceId = str(b.workplaceId);
    const projectId = str(b.projectId);
    const workplace = workplaceId
      ? await prisma.workplace.findUnique({ where: { id: workplaceId } })
      : null;
    const workType = (str(b.workType) as 'FACTORY' | 'SITE' | 'ETC') ?? workplace?.type ?? 'FACTORY';

    // ── GPS 검증 ─────────────────────────────────
    const lat = b.lat != null && b.lat !== '' ? Number(b.lat) : null;
    const lng = b.lng != null && b.lng !== '' ? Number(b.lng) : null;
    const verdict = verifyLocation(lat, lng, workplace);

    if (verdict.status === 'OUT_OF_RANGE' && !b.forceOutOfRange) {
      return fail('지정된 근무지에서 멀리 떨어져 있습니다.', 422, {
        code: 'OUT_OF_RANGE',
        distanceM: verdict.distanceM,
        radiusM: workplace?.radiusM,
        workplaceName: workplace?.name,
      });
    }

    // ── 지각 판정 ────────────────────────────────
    const settings = await getWorkSettings();
    const nowAt = new Date();
    const p = kstParts(nowAt);
    const isLate = p.hour * 60 + p.minute > hhmmToMinutes(settings.lateThreshold);

    const created = await prisma.attendance.upsert({
      where: { employeeId_workDate: { employeeId, workDate } },
      create: {
        employeeId,
        workDate,
        checkInAt: nowAt,
        workplaceId,
        projectId,
        workType,
        status: 'WORKING',
        checkInLat: lat,
        checkInLng: lng,
        checkInDistanceM: verdict.distanceM,
        checkInGps: verdict.status === 'OUT_OF_RANGE' ? 'APPROVED' : verdict.status,
        checkInIp: clientIp(req),
        checkInDevice: userAgent(req),
        photoUrl: str(b.photoUrl),
        employeeMemo: str(b.memo),
        isLate,
      },
      update: {
        checkInAt: nowAt,
        workplaceId,
        projectId,
        workType,
        status: 'WORKING',
        checkInLat: lat,
        checkInLng: lng,
        checkInDistanceM: verdict.distanceM,
        checkInGps: verdict.status === 'OUT_OF_RANGE' ? 'APPROVED' : verdict.status,
        checkInIp: clientIp(req),
        checkInDevice: userAgent(req),
        photoUrl: str(b.photoUrl),
        isLate,
      },
    });

    await syncAutoAllowances(created.id);
    const att = await recalcAttendance(created.id, settings);

    await writeAudit(session, {
      entity: 'attendance',
      entityId: created.id,
      action: 'CHECK_IN',
      after: {
        employee: employee.name,
        workDate: kstDateStr(nowAt),
        checkInAt: nowAt.toISOString(),
        workType,
        gps: verdict.status,
        distanceM: verdict.distanceM,
      },
      ip: clientIp(req),
    });

    await notify({
      type: 'CHECK_IN',
      title: '출근',
      body: `${employee.name}님이 ${kstTimeStr(nowAt)} 출근했습니다.`,
      employeeId,
    });

    return ok({
      attendanceId: att.id,
      employeeName: employee.name,
      workDate: kstDateStr(nowAt),
      checkInTime: kstTimeStr(nowAt),
      workplaceName: workplace?.name ?? '미지정',
      isLate,
      gps: verdict.status,
      distanceM: verdict.distanceM,
    });
  } catch (e) {
    return handleError(e);
  }
}
