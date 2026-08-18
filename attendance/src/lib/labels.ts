/** 열거형 → 한국어 라벨 */
export const WORKPLACE_TYPE_LABEL = {
  FACTORY: '공장',
  SITE: '현장',
  ETC: '기타',
} as const;

export const EMPLOYEE_STATUS_LABEL = {
  ACTIVE: '재직',
  LEAVE: '휴직',
  RESIGNED: '퇴사',
} as const;

export const ATTENDANCE_STATUS_LABEL = {
  WORKING: '근무중',
  ON_BREAK: '휴게중',
  DONE: '퇴근완료',
  ABSENT: '결근',
  LEAVE_DAY: '휴무/연차',
} as const;

export const CALC_METHOD_LABEL = {
  FULL_DAY: '방식 A · 일당 전액',
  HOURLY_PRORATED: '방식 B · 시간 비례',
  DAY_PLUS_OT: '방식 C · 일당 + 연장수당',
} as const;

export const ALLOWANCE_TYPE_LABEL = {
  OVERTIME: '연장수당',
  NIGHT: '야간수당',
  HOLIDAY: '휴일수당',
  MEAL: '식대',
  LODGING: '숙박비',
  VEHICLE: '차량비',
  TRIP: '출장비',
  HAZARD: '위험수당',
  ETC: '기타수당',
} as const;

export const DEDUCTION_TYPE_LABEL = {
  PREPAY: '선지급',
  ADVANCE: '가불',
  MEAL: '식대공제',
  LODGING: '숙박비공제',
  EQUIPMENT_LOSS: '장비손실',
  ETC: '기타공제',
} as const;

export const PAYROLL_STATUS_LABEL = {
  DRAFT: '미정산',
  CONFIRMED: '정산완료',
  UNPAID: '미지급',
  PARTIAL: '일부지급',
  PAID: '지급완료',
} as const;

export const PAYMENT_METHOD_LABEL = {
  TRANSFER: '계좌이체',
  CASH: '현금',
  ETC: '기타',
} as const;

export const PROJECT_STATUS_LABEL = {
  PLANNED: '예정',
  ONGOING: '진행중',
  DONE: '완료',
  HOLD: '보류',
} as const;

export const EDIT_REQUEST_STATUS_LABEL = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
} as const;

export const GPS_LABEL = {
  OK: '정상',
  OUT_OF_RANGE: '반경이탈',
  NO_GPS: '위치없음',
  APPROVED: '이탈(승인됨)',
} as const;
