/** 화면 표기 헬퍼 (클라이언트/서버 공용) */
export { won } from './payroll';
import { minutesToHours } from './time';

/** 분 → '176.0시간' */
export function minutesToHoursLabel(min: number): string {
  return `${minutesToHours(min).toFixed(1)}시간`;
}
