/**
 * 대한민국 시간(KST, UTC+9) 유틸리티.
 *
 * 저장 원칙
 *  - DateTime 컬럼은 UTC(timestamptz)로 저장한다.
 *  - Date 컬럼(workDate 등)은 "KST 기준 날짜"를 UTC 자정으로 표현해 저장한다.
 *    (예: 2026-08-19(KST) → 2026-08-19T00:00:00Z)
 *  - 화면 표시는 항상 KST로 변환한다.
 *
 * 서버 타임존이 UTC든 KST든 동일하게 동작하도록 오프셋을 직접 계산한다.
 */

export const KST_OFFSET_MIN = 9 * 60;
const MS_PER_MIN = 60_000;

/** 현재 시각 (UTC Date 객체) */
export function now(): Date {
  return new Date();
}

/** UTC Date → KST 기준으로 각 필드를 읽기 위한 "이동된" Date */
function toKstShifted(d: Date): Date {
  return new Date(d.getTime() + KST_OFFSET_MIN * MS_PER_MIN);
}

/** KST 기준 연/월/일/시/분/초를 뽑아낸다. */
export function kstParts(d: Date) {
  const s = toKstShifted(d);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
    second: s.getUTCSeconds(),
    weekday: s.getUTCDay(), // 0=일 ... 6=토
  };
}

/** KST 기준 'YYYY-MM-DD' */
export function kstDateStr(d: Date = new Date()): string {
  const p = kstParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** KST 기준 'HH:mm' */
export function kstTimeStr(d: Date | null | undefined): string {
  if (!d) return '-';
  const p = kstParts(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** KST 기준 'YYYY-MM-DD HH:mm' */
export function kstDateTimeStr(d: Date | null | undefined): string {
  if (!d) return '-';
  return `${kstDateStr(d)} ${kstTimeStr(d)}`;
}

/** KST 기준 'M월 D일 (요일)' */
export function kstDateKorean(d: Date): string {
  const p = kstParts(d);
  return `${p.month}월 ${p.day}일 (${WEEKDAY_KO[p.weekday]})`;
}

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 'YYYY-MM-DD' (KST 기준 날짜) → DB의 Date 컬럼에 저장할 Date 객체.
 * UTC 자정으로 만들어 타임존 이동에 따른 날짜 밀림을 방지한다.
 */
export function dateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/** Date 컬럼 값 → 'YYYY-MM-DD' */
export function dateOnlyStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 오늘(KST) 의 Date 컬럼 값 */
export function todayDateOnly(): Date {
  return dateOnly(kstDateStr());
}

/**
 * KST 기준 'YYYY-MM-DD' + 'HH:mm' → 실제 시각(UTC Date).
 * 예: ('2026-08-19','07:58') → 2026-08-18T22:58:00Z
 */
export function kstToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0) - KST_OFFSET_MIN * MS_PER_MIN);
}

/** datetime-local 입력값('YYYY-MM-DDTHH:mm', KST) → UTC Date */
export function kstLocalInputToUtc(v: string): Date | null {
  if (!v) return null;
  const [dateStr, timeStr] = v.split('T');
  if (!dateStr || !timeStr) return null;
  return kstToUtc(dateStr, timeStr.slice(0, 5));
}

/** UTC Date → datetime-local 입력값('YYYY-MM-DDTHH:mm', KST) */
export function utcToKstLocalInput(d: Date | null | undefined): string {
  if (!d) return '';
  const p = kstParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** 해당 월(KST)의 시작/종료 Date 컬럼 값 */
export function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // 말일
  return { start, end };
}

/** 분 → '9시간 34분' */
export function minutesToKorean(min: number): string {
  if (!min || min <= 0) return '0분';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** 분 → 소수 시간 (예: 574 → 9.57) */
export function minutesToHours(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

/** KST 기준 주말 여부 */
export function isWeekendKst(d: Date): boolean {
  const w = kstParts(d).weekday;
  return w === 0 || w === 6;
}

/** Date 컬럼(UTC 자정) 값의 요일 */
export function dateOnlyWeekday(d: Date): number {
  return d.getUTCDay();
}
