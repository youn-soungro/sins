/**
 * 근무시간 · 일당 계산 엔진.
 *
 * 이 파일은 금액을 만드는 유일한 곳이다. API 라우트에서 직접 금액을 계산하지 말고
 * 반드시 이 함수들을 통해 계산해 계산식이 한 곳에만 존재하도록 한다.
 *
 * 모든 금액은 원 단위 정수(Int)로 다룬다. 나눗셈 결과는 Math.round 로 반올림한다.
 */

import type { PayCalcMethod, WorkplaceType } from '@prisma/client';

const MS_PER_MIN = 60_000;
const KST_OFFSET_MIN = 9 * 60;

/** 근무 계산에 필요한 설정값 */
export interface WorkSettings {
  /** 기본 근무 시작시각 'HH:mm' (KST) */
  workStart: string;
  /** 기본 근무 종료시각 'HH:mm' (KST) */
  workEnd: string;
  /** 기본 휴게 시작 'HH:mm' */
  breakStart: string;
  /** 기본 휴게 종료 'HH:mm' */
  breakEnd: string;
  /** 기본(정상) 근무시간 — 분 */
  standardMinutes: number;
  /** 지각 판정 기준 'HH:mm' */
  lateThreshold: string;
  /** 야간근무 시작 'HH:mm' (기본 22:00) */
  nightStart: string;
  /** 야간근무 종료 'HH:mm' (기본 06:00) */
  nightEnd: string;
  /** 퇴근 누락 자동마감 기준 시간(시간 단위) */
  autoCloseAfterHours: number;
}

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  workStart: '08:00',
  workEnd: '17:00',
  breakStart: '12:00',
  breakEnd: '13:00',
  standardMinutes: 480, // 8시간
  lateThreshold: '08:10',
  nightStart: '22:00',
  nightEnd: '06:00',
  autoCloseAfterHours: 16,
};

/** 직원에게 적용할 단가 묶음 */
export interface RateSet {
  calcMethod: PayCalcMethod;
  baseDailyWage: number;
  factoryDailyWage: number;
  siteDailyWage: number;
  overtimeHourlyRate: number;
  nightHourlyRate: number;
  holidayHourlyRate: number;
  mealAllowance: number;
  lodgingAllowance: number;
  vehicleAllowance: number;
  otherAllowance: number;
}

export const EMPTY_RATE_SET: RateSet = {
  calcMethod: 'DAY_PLUS_OT',
  baseDailyWage: 0,
  factoryDailyWage: 0,
  siteDailyWage: 0,
  overtimeHourlyRate: 0,
  nightHourlyRate: 0,
  holidayHourlyRate: 0,
  mealAllowance: 0,
  lodgingAllowance: 0,
  vehicleAllowance: 0,
  otherAllowance: 0,
};

/** 휴게 구간 */
export interface BreakSpan {
  startAt: Date;
  endAt: Date | null;
}

// ───────────────────────── 시간 계산 ─────────────────────────

/** 'HH:mm' → 자정 기준 분 */
export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 겹치는 휴게 구간을 합쳐 중복 계산을 막는다. */
export function mergeBreakSpans(
  spans: BreakSpan[],
  fallbackEnd: Date | null,
): Array<{ start: number; end: number }> {
  const normalized = spans
    .map((s) => {
      const start = s.startAt.getTime();
      const rawEnd = (s.endAt ?? fallbackEnd)?.getTime() ?? start;
      return { start, end: Math.max(start, rawEnd) };
    })
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const span of normalized) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

/**
 * 근무구간과 겹치는 휴게시간(분)만 계산한다.
 * 퇴근 후에 남아있는 휴게 기록은 근무시간에서 빼지 않는다.
 */
export function calcBreakMinutes(
  checkInAt: Date,
  checkOutAt: Date | null,
  spans: BreakSpan[],
): number {
  const workStart = checkInAt.getTime();
  const workEnd = (checkOutAt ?? new Date()).getTime();
  if (workEnd <= workStart) return 0;

  const merged = mergeBreakSpans(spans, checkOutAt ?? new Date());
  let total = 0;
  for (const s of merged) {
    const overlap = Math.min(s.end, workEnd) - Math.max(s.start, workStart);
    if (overlap > 0) total += overlap;
  }
  return Math.floor(total / MS_PER_MIN);
}

/**
 * 야간근무(기본 22:00~06:00 KST) 시간을 분 단위로 계산한다.
 * 자정을 넘겨도 올바르게 누적되도록 구간을 하루 단위로 순회한다.
 */
export function calcNightMinutes(
  checkInAt: Date,
  checkOutAt: Date | null,
  settings: WorkSettings,
): number {
  const end = checkOutAt ?? new Date();
  if (end <= checkInAt) return 0;

  const nightStart = hhmmToMinutes(settings.nightStart); // 예: 1320 (22:00)
  const nightEnd = hhmmToMinutes(settings.nightEnd); // 예: 360 (06:00)

  // KST 기준 자정으로 정렬된 시작점을 만든다.
  const shiftedStart = checkInAt.getTime() + KST_OFFSET_MIN * MS_PER_MIN;
  const dayStartShifted = Math.floor(shiftedStart / 86_400_000) * 86_400_000;

  let total = 0;
  // 최대 3일치 구간만 순회하면 어떤 교대근무도 커버된다.
  for (let i = -1; i <= 2; i++) {
    const base = dayStartShifted + i * 86_400_000 - KST_OFFSET_MIN * MS_PER_MIN;
    const windows: Array<[number, number]> =
      nightStart > nightEnd
        ? [
            // 22:00 ~ 다음날 06:00 → 두 구간으로 나눠서 처리
            [base + nightStart * MS_PER_MIN, base + (24 * 60 + nightEnd) * MS_PER_MIN],
          ]
        : [[base + nightStart * MS_PER_MIN, base + nightEnd * MS_PER_MIN]];

    for (const [ws, we] of windows) {
      const overlap = Math.min(we, end.getTime()) - Math.max(ws, checkInAt.getTime());
      if (overlap > 0) total += overlap;
    }
  }
  return Math.floor(total / MS_PER_MIN);
}

export interface WorkTimeResult {
  totalMinutes: number;
  breakMinutes: number;
  actualMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
}

/**
 * 근무시간 계산.
 *
 *   실근무시간 = 퇴근시간 - 출근시간 - 휴게시간
 *   연장근무시간 = 실근무시간 - 기본근무시간   (음수면 0)
 *
 * 퇴근 전(진행중)이면 현재 시각까지로 계산한다.
 */
export function calcWorkTime(
  checkInAt: Date,
  checkOutAt: Date | null,
  breaks: BreakSpan[],
  settings: WorkSettings,
  nowRef: Date = new Date(),
): WorkTimeResult {
  const end = checkOutAt ?? nowRef;
  const totalMs = Math.max(0, end.getTime() - checkInAt.getTime());
  const totalMinutes = Math.floor(totalMs / MS_PER_MIN);

  const breakMinutes = Math.min(totalMinutes, calcBreakMinutes(checkInAt, checkOutAt ?? nowRef, breaks));
  const actualMinutes = Math.max(0, totalMinutes - breakMinutes);

  const standard = settings.standardMinutes;
  const normalMinutes = Math.min(actualMinutes, standard);
  const overtimeMinutes = Math.max(0, actualMinutes - standard);
  const nightMinutes = calcNightMinutes(checkInAt, checkOutAt ?? nowRef, settings);

  return { totalMinutes, breakMinutes, actualMinutes, normalMinutes, overtimeMinutes, nightMinutes };
}

// ───────────────────────── 금액 계산 ─────────────────────────

/** 근무지 구분에 따라 적용할 일당을 고른다. (해당 일당이 0이면 기본 일당으로 대체) */
export function pickDailyWage(rates: RateSet, workType: WorkplaceType): number {
  if (workType === 'FACTORY') return rates.factoryDailyWage || rates.baseDailyWage;
  if (workType === 'SITE') return rates.siteDailyWage || rates.baseDailyWage;
  return rates.baseDailyWage;
}

/**
 * 연장 시간당 단가.
 * 단가가 별도로 지정되지 않았으면 "일당 ÷ 기본근무시간" 으로 자동 계산한다.
 * (예: 250,000 ÷ 8시간 = 31,250원)
 */
export function resolveOvertimeRate(
  rates: RateSet,
  dailyWage: number,
  settings: WorkSettings,
): number {
  if (rates.overtimeHourlyRate > 0) return rates.overtimeHourlyRate;
  const standardHours = settings.standardMinutes / 60;
  if (standardHours <= 0) return 0;
  return Math.round(dailyWage / standardHours);
}

export interface PayResult {
  appliedDailyWage: number;
  appliedOtRate: number;
  basePay: number;
  overtimePay: number;
  nightPay: number;
  holidayPay: number;
  /** 기본급 + 연장 + 야간 + 휴일 (추가수당/공제 제외) */
  subtotal: number;
}

/**
 * 일당 계산.
 *
 *  방식 A (FULL_DAY)        : 정상근무 시 일당 전액. 연장수당 별도 미지급.
 *  방식 B (HOURLY_PRORATED) : 시간 비례. 실근무시간 × (일당 ÷ 기본근무시간).
 *  방식 C (DAY_PLUS_OT)     : 일당 + (연장시간 × 연장단가).
 */
export function calcPay(
  work: WorkTimeResult,
  rates: RateSet,
  workType: WorkplaceType,
  settings: WorkSettings,
  opts: { isHoliday?: boolean; hasCheckedOut?: boolean } = {},
): PayResult {
  const dailyWage = pickDailyWage(rates, workType);
  const otRate = resolveOvertimeRate(rates, dailyWage, settings);
  const standard = settings.standardMinutes;

  let basePay = 0;
  let overtimePay = 0;

  switch (rates.calcMethod) {
    case 'FULL_DAY': {
      // 근무기록이 있으면 일당 전액. 단, 기본근무의 절반도 못 채우면 시간비례로 감액.
      const half = standard / 2;
      basePay =
        work.actualMinutes >= half
          ? dailyWage
          : Math.round((dailyWage * work.actualMinutes) / (standard || 1));
      overtimePay = 0;
      break;
    }
    case 'HOURLY_PRORATED': {
      const perMinute = standard > 0 ? dailyWage / standard : 0;
      basePay = Math.round(perMinute * work.actualMinutes);
      overtimePay = 0;
      break;
    }
    case 'DAY_PLUS_OT':
    default: {
      const half = standard / 2;
      basePay =
        work.actualMinutes >= half
          ? dailyWage
          : Math.round((dailyWage * work.actualMinutes) / (standard || 1));
      overtimePay = Math.round((otRate * work.overtimeMinutes) / 60);
      break;
    }
  }

  // 야간·휴일 단가가 설정된 경우에만 가산한다. (중복 지급을 막기 위해 기본값은 0)
  const nightPay =
    rates.nightHourlyRate > 0 ? Math.round((rates.nightHourlyRate * work.nightMinutes) / 60) : 0;
  const holidayPay =
    opts.isHoliday && rates.holidayHourlyRate > 0
      ? Math.round((rates.holidayHourlyRate * work.actualMinutes) / 60)
      : 0;

  return {
    appliedDailyWage: dailyWage,
    appliedOtRate: otRate,
    basePay,
    overtimePay,
    nightPay,
    holidayPay,
    subtotal: basePay + overtimePay + nightPay + holidayPay,
  };
}

/** 단가표에 등록된 고정수당(식대/숙박/차량/기타)의 일 합계 */
export function fixedAllowanceTotal(rates: RateSet): number {
  return (
    rates.mealAllowance + rates.lodgingAllowance + rates.vehicleAllowance + rates.otherAllowance
  );
}

/** 금액 표기 (1,234,567) */
export function won(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('ko-KR');
}
