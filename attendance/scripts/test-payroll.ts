/** 계산 엔진 검증 — 지시문에 나온 예시 수치로 확인한다. */
import { calcWorkTime, calcPay, DEFAULT_WORK_SETTINGS, EMPTY_RATE_SET, calcBreakMinutes } from '../src/lib/payroll';
import { kstToUtc, minutesToKorean, kstTimeStr } from '../src/lib/time';

let failed = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failed++;
  console.log(`${pass ? '✔' : '✘'} ${label}: ${JSON.stringify(actual)}${pass ? '' : ` (기대: ${JSON.stringify(expected)})`}`);
}

const S = DEFAULT_WORK_SETTINGS;

// ── 예시 1: 07:58 출근 ~ 18:32 퇴근, 휴게 1시간 ──
const ci = kstToUtc('2026-08-19', '07:58');
const co = kstToUtc('2026-08-19', '18:32');
const breaks = [{ startAt: kstToUtc('2026-08-19', '12:01'), endAt: kstToUtc('2026-08-19', '13:01') }];
const w = calcWorkTime(ci, co, breaks, S);
eq('총 체류시간', minutesToKorean(w.totalMinutes), '10시간 34분');
eq('휴게시간', minutesToKorean(w.breakMinutes), '1시간');
eq('실근무', minutesToKorean(w.actualMinutes), '9시간 34분');
eq('기본근무', minutesToKorean(w.normalMinutes), '8시간');
eq('연장근무', minutesToKorean(w.overtimeMinutes), '1시간 34분');
eq('KST 시각표시(출근)', kstTimeStr(ci), '07:58');

// ── 예시 2: 방식 C — 일당 250,000 + 연장 2시간 × 31,250 = 312,500 ──
const rates2 = { ...EMPTY_RATE_SET, calcMethod: 'DAY_PLUS_OT' as const, baseDailyWage: 250_000, factoryDailyWage: 250_000 };
const w2 = calcWorkTime(kstToUtc('2026-08-19','08:00'), kstToUtc('2026-08-19','19:00'),
  [{ startAt: kstToUtc('2026-08-19','12:00'), endAt: kstToUtc('2026-08-19','13:00') }], S);
eq('방식C 연장시간(분)', w2.overtimeMinutes, 120);
const p2 = calcPay(w2, rates2, 'FACTORY', S);
eq('방식C 연장단가 자동계산', p2.appliedOtRate, 31_250);
eq('방식C 총액', p2.subtotal, 312_500);

// ── 예시 3: 방식 B — 시간 비례 ──
const rates3 = { ...rates2, calcMethod: 'HOURLY_PRORATED' as const };
const p3 = calcPay(w2, rates3, 'FACTORY', S);
eq('방식B 기본급(10시간)', p3.subtotal, Math.round(250_000 / 480 * 600));

// ── 예시 4: 방식 A — 일당 전액, 연장수당 없음 ──
const p4 = calcPay(w2, { ...rates2, calcMethod: 'FULL_DAY' }, 'FACTORY', S);
eq('방식A 총액', p4.subtotal, 250_000);

// ── 예시 5: 현장 일당 우선 적용 ──
const p5 = calcPay(w2, { ...rates2, siteDailyWage: 300_000 }, 'SITE', S);
eq('현장 일당 적용', p5.appliedDailyWage, 300_000);

// ── 예시 6: 야간근무 자정 넘김 (20:00 ~ 다음날 04:00) ──
const w6 = calcWorkTime(kstToUtc('2026-08-19','20:00'), kstToUtc('2026-08-20','04:00'), [], S);
eq('자정넘김 총 체류', w6.totalMinutes, 480);
eq('야간근무 분(22:00~04:00)', w6.nightMinutes, 360);

// ── 예시 7: 휴게 중복 구간은 한 번만 계산 ──
const dupBreaks = [
  { startAt: kstToUtc('2026-08-19','12:00'), endAt: kstToUtc('2026-08-19','13:00') },
  { startAt: kstToUtc('2026-08-19','12:30'), endAt: kstToUtc('2026-08-19','13:30') },
];
eq('휴게 중복 병합', calcBreakMinutes(kstToUtc('2026-08-19','08:00'), kstToUtc('2026-08-19','18:00'), dupBreaks), 90);

// ── 예시 8: 여러 번 휴게 (12:01~12:43, 15:20~15:31) ──
const multi = [
  { startAt: kstToUtc('2026-08-19','12:01'), endAt: kstToUtc('2026-08-19','12:43') },
  { startAt: kstToUtc('2026-08-19','15:20'), endAt: kstToUtc('2026-08-19','15:31') },
];
eq('휴게 합계 42+11', calcBreakMinutes(kstToUtc('2026-08-19','08:00'), kstToUtc('2026-08-19','18:00'), multi), 53);

// ── 예시 9: 연장시간 음수 방지 (조퇴) ──
const w9 = calcWorkTime(kstToUtc('2026-08-19','08:00'), kstToUtc('2026-08-19','12:00'), [], S);
eq('조퇴 시 연장 0', w9.overtimeMinutes, 0);

console.log(failed === 0 ? '\n■ 전체 통과' : `\n■ 실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
