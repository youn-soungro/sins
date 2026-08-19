/**
 * 출퇴근 기록의 파생값(근무시간·금액)을 다시 계산해 저장한다.
 *
 * 출근/퇴근/휴게/관리자수정/수정요청승인 등 기록이 바뀌는 모든 경로에서
 * 이 함수를 호출해, 화면마다 다른 값이 나오는 일이 없도록 한다.
 */
import { prisma } from './prisma';
import { getWorkSettings } from './settings';
import {
  calcPay,
  calcWorkTime,
  EMPTY_RATE_SET,
  type RateSet,
  type WorkSettings,
} from './payroll';
import { dateOnlyWeekday } from './time';
import type { Prisma } from '@prisma/client';

/** 특정 날짜에 유효한 직원 단가를 가져온다. (없으면 0 단가) */
export async function getEffectiveRates(employeeId: string, workDate: Date): Promise<RateSet> {
  const rate = await prisma.employeePayRate.findFirst({
    where: { employeeId, effectiveFrom: { lte: workDate } },
    orderBy: { effectiveFrom: 'desc' },
  });
  // 근무일 이전 단가가 없으면 가장 이른 단가라도 적용한다. (등록 누락 방지)
  const fallback =
    rate ??
    (await prisma.employeePayRate.findFirst({
      where: { employeeId },
      orderBy: { effectiveFrom: 'asc' },
    }));
  if (!fallback) return { ...EMPTY_RATE_SET };
  return {
    calcMethod: fallback.calcMethod,
    baseDailyWage: fallback.baseDailyWage,
    factoryDailyWage: fallback.factoryDailyWage,
    siteDailyWage: fallback.siteDailyWage,
    overtimeHourlyRate: fallback.overtimeHourlyRate,
    nightHourlyRate: fallback.nightHourlyRate,
    holidayHourlyRate: fallback.holidayHourlyRate,
    mealAllowance: fallback.mealAllowance,
    lodgingAllowance: fallback.lodgingAllowance,
    vehicleAllowance: fallback.vehicleAllowance,
    otherAllowance: fallback.otherAllowance,
  };
}

/**
 * 출퇴근 기록 1건을 재계산해 DB에 반영하고, 갱신된 기록을 돌려준다.
 * 퇴근 전이면 현재 시각 기준으로 진행중 값을 계산한다.
 */
export async function recalcAttendance(attendanceId: string, settingsArg?: WorkSettings) {
  const settings = settingsArg ?? (await getWorkSettings());

  const att = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { breaks: true, allowances: true },
  });
  if (!att) throw new Error('출퇴근 기록을 찾을 수 없습니다.');
  if (!att.checkInAt) return att;

  const rates = await getEffectiveRates(att.employeeId, att.workDate);

  const work = calcWorkTime(att.checkInAt, att.checkOutAt, att.breaks, settings);
  const isHoliday = att.isHoliday || [0, 6].includes(dateOnlyWeekday(att.workDate));

  const pay = calcPay(work, rates, att.workType, settings, {
    isHoliday,
    hasCheckedOut: !!att.checkOutAt,
  });

  const allowanceTotal = att.allowances.reduce((s, a) => s + a.amount, 0);

  const data: Prisma.AttendanceUpdateInput = {
    totalMinutes: work.totalMinutes,
    breakMinutes: work.breakMinutes,
    actualMinutes: work.actualMinutes,
    normalMinutes: work.normalMinutes,
    overtimeMinutes: work.overtimeMinutes,
    nightMinutes: work.nightMinutes,
    isHoliday,
    appliedCalcMethod: rates.calcMethod,
    appliedDailyWage: pay.appliedDailyWage,
    appliedOtRate: pay.appliedOtRate,
    basePay: pay.basePay,
    overtimePay: pay.overtimePay,
    nightPay: pay.nightPay,
    holidayPay: pay.holidayPay,
    allowanceTotal,
    dayTotalPay: pay.subtotal + allowanceTotal,
  };

  return prisma.attendance.update({ where: { id: attendanceId }, data });
}

/**
 * 단가표의 고정수당(식대/숙박/차량/기타)을 해당 근무일 수당으로 자동 생성한다.
 * isAuto=true 인 항목만 지우고 다시 만들어, 관리자가 손으로 넣은 수당은 보존한다.
 */
export async function syncAutoAllowances(attendanceId: string) {
  const att = await prisma.attendance.findUnique({ where: { id: attendanceId } });
  if (!att) return;
  const rates = await getEffectiveRates(att.employeeId, att.workDate);

  await prisma.allowance.deleteMany({ where: { attendanceId, isAuto: true } });

  const rows: Prisma.AllowanceCreateManyInput[] = [];
  const base = {
    employeeId: att.employeeId,
    attendanceId: att.id,
    projectId: att.projectId,
    workDate: att.workDate,
    isAuto: true,
  };
  if (rates.mealAllowance > 0) rows.push({ ...base, type: 'MEAL', amount: rates.mealAllowance, memo: '단가표 자동적용' });
  if (rates.lodgingAllowance > 0) rows.push({ ...base, type: 'LODGING', amount: rates.lodgingAllowance, memo: '단가표 자동적용' });
  if (rates.vehicleAllowance > 0) rows.push({ ...base, type: 'VEHICLE', amount: rates.vehicleAllowance, memo: '단가표 자동적용' });
  if (rates.otherAllowance > 0) rows.push({ ...base, type: 'ETC', amount: rates.otherAllowance, memo: '단가표 자동적용' });

  if (rows.length) await prisma.allowance.createMany({ data: rows });
}

/**
 * 퇴근 누락 자동 마감.
 * 출근 후 설정된 시간이 지나도 퇴근하지 않은 기록을 정리한다.
 * 근무시간이 무한정 늘어나 인건비가 부풀려지는 것을 막는다.
 */
export async function autoCloseStaleAttendances(): Promise<number> {
  const settings = await getWorkSettings();
  const limitMs = settings.autoCloseAfterHours * 60 * 60 * 1000;
  const threshold = new Date(Date.now() - limitMs);

  const stale = await prisma.attendance.findMany({
    where: {
      checkOutAt: null,
      checkInAt: { lt: threshold, not: null },
      status: { in: ['WORKING', 'ON_BREAK'] },
    },
    include: { breaks: true },
  });

  for (const att of stale) {
    if (!att.checkInAt) continue;
    const closeAt = new Date(att.checkInAt.getTime() + limitMs);
    // 열려있는 휴게도 함께 닫는다.
    for (const b of att.breaks) {
      if (!b.endAt) {
        const end = closeAt < b.startAt ? b.startAt : closeAt;
        await prisma.breakLog.update({
          where: { id: b.id },
          data: { endAt: end, minutes: Math.floor((end.getTime() - b.startAt.getTime()) / 60000) },
        });
      }
    }
    await prisma.attendance.update({
      where: { id: att.id },
      data: {
        checkOutAt: closeAt,
        status: 'DONE',
        isAutoClosed: true,
        adminMemo: [att.adminMemo, '※ 퇴근 미기록으로 자동 마감됨. 관리자 확인 필요.']
          .filter(Boolean)
          .join('\n'),
      },
    });
    await recalcAttendance(att.id, settings);
  }
  return stale.length;
}
