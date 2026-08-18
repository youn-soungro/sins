/**
 * 월별 정산.
 * "직원 선택 → 해당 월 선택 → 정산" 만으로 근무일수·연장시간·일당·수당·공제·최종
 * 지급액이 모두 계산되도록 한다.
 */
import { prisma } from './prisma';
import { monthRange } from './time';
import type { PayrollStatus } from '@prisma/client';

export interface PayrollSummary {
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
  workDays: number;
  factoryDays: number;
  siteDays: number;
  normalMinutes: number;
  overtimeMinutes: number;
  basePayTotal: number;
  overtimePayTotal: number;
  nightPayTotal: number;
  holidayPayTotal: number;
  mealTotal: number;
  lodgingTotal: number;
  vehicleTotal: number;
  otherAllowanceTotal: number;
  allowanceTotal: number;
  deductionTotal: number;
  grossTotal: number;
  netTotal: number;
}

/**
 * 저장하지 않고 해당 월 금액을 계산한다. (미리보기 / 목록용)
 * 출퇴근 기록에 저장된 스냅샷 금액을 합산하므로, 단가를 나중에 바꿔도
 * 이미 지난 근무의 금액이 흔들리지 않는다.
 */
export async function computePayroll(
  employeeId: string,
  year: number,
  month: number,
): Promise<PayrollSummary> {
  const { start, end } = monthRange(year, month);

  const [employee, attendances, allowances, deductions] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.attendance.findMany({
      where: { employeeId, workDate: { gte: start, lte: end }, checkInAt: { not: null } },
    }),
    prisma.allowance.findMany({ where: { employeeId, workDate: { gte: start, lte: end } } }),
    prisma.deduction.findMany({ where: { employeeId, workDate: { gte: start, lte: end } } }),
  ]);
  if (!employee) throw new Error('직원을 찾을 수 없습니다.');

  const worked = attendances.filter((a) => a.actualMinutes > 0);

  const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0);

  const basePayTotal = sum(attendances, (a) => a.basePay);
  const overtimePayTotal = sum(attendances, (a) => a.overtimePay);
  const nightPayTotal = sum(attendances, (a) => a.nightPay);
  const holidayPayTotal = sum(attendances, (a) => a.holidayPay);

  const byType = (t: string) => sum(allowances.filter((x) => x.type === t), (x) => x.amount);
  const mealTotal = byType('MEAL');
  const lodgingTotal = byType('LODGING');
  const vehicleTotal = byType('VEHICLE');
  const allowanceTotal = sum(allowances, (a) => a.amount);
  const otherAllowanceTotal = allowanceTotal - mealTotal - lodgingTotal - vehicleTotal;

  const deductionTotal = sum(deductions, (d) => d.amount);

  const grossTotal =
    basePayTotal + overtimePayTotal + nightPayTotal + holidayPayTotal + allowanceTotal;

  return {
    employeeId,
    employeeName: employee.name,
    year,
    month,
    workDays: worked.length,
    factoryDays: worked.filter((a) => a.workType === 'FACTORY').length,
    siteDays: worked.filter((a) => a.workType === 'SITE').length,
    normalMinutes: sum(attendances, (a) => a.normalMinutes),
    overtimeMinutes: sum(attendances, (a) => a.overtimeMinutes),
    basePayTotal,
    overtimePayTotal,
    nightPayTotal,
    holidayPayTotal,
    mealTotal,
    lodgingTotal,
    vehicleTotal,
    otherAllowanceTotal,
    allowanceTotal,
    deductionTotal,
    grossTotal,
    netTotal: grossTotal - deductionTotal,
  };
}

/**
 * 계산 결과를 payroll 테이블에 저장(생성 또는 갱신)한다.
 * 이미 지급이 진행된 정산은 지급액을 보존한 채 금액만 다시 맞춘다.
 */
export async function upsertPayroll(
  employeeId: string,
  year: number,
  month: number,
  opts: { confirm?: boolean; adminId?: string; memo?: string | null } = {},
) {
  const s = await computePayroll(employeeId, year, month);
  const { start, end } = monthRange(year, month);

  const existing = await prisma.payroll.findUnique({
    where: { employeeId_year_month: { employeeId, year, month } },
    include: { payments: true },
  });

  const paidTotal = existing?.payments.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const unpaidTotal = Math.max(0, s.netTotal - paidTotal);

  let status: PayrollStatus = existing?.status ?? 'DRAFT';
  if (opts.confirm) status = 'CONFIRMED';
  if (paidTotal > 0) status = unpaidTotal <= 0 ? 'PAID' : 'PARTIAL';
  else if (status === 'CONFIRMED' && s.netTotal > 0) status = 'CONFIRMED';

  const data = {
    periodStart: start,
    periodEnd: end,
    workDays: s.workDays,
    factoryDays: s.factoryDays,
    siteDays: s.siteDays,
    normalMinutes: s.normalMinutes,
    overtimeMinutes: s.overtimeMinutes,
    basePayTotal: s.basePayTotal,
    overtimePayTotal: s.overtimePayTotal,
    nightPayTotal: s.nightPayTotal,
    holidayPayTotal: s.holidayPayTotal,
    mealTotal: s.mealTotal,
    lodgingTotal: s.lodgingTotal,
    vehicleTotal: s.vehicleTotal,
    otherAllowanceTotal: s.otherAllowanceTotal,
    allowanceTotal: s.allowanceTotal,
    deductionTotal: s.deductionTotal,
    grossTotal: s.grossTotal,
    netTotal: s.netTotal,
    paidTotal,
    unpaidTotal,
    status,
    ...(opts.memo !== undefined ? { memo: opts.memo } : {}),
    ...(opts.confirm
      ? { confirmedAt: new Date(), confirmedBy: opts.adminId ?? null }
      : {}),
  };

  return prisma.payroll.upsert({
    where: { employeeId_year_month: { employeeId, year, month } },
    create: { employeeId, year, month, ...data },
    update: data,
  });
}

/** 지급액이 바뀐 뒤 정산 상태를 다시 맞춘다. */
export async function refreshPayrollPaymentState(payrollId: string) {
  const p = await prisma.payroll.findUnique({
    where: { id: payrollId },
    include: { payments: true },
  });
  if (!p) return null;
  const paidTotal = p.payments.reduce((s, x) => s + x.amount, 0);
  const unpaidTotal = Math.max(0, p.netTotal - paidTotal);
  const status: PayrollStatus =
    paidTotal <= 0
      ? p.confirmedAt
        ? 'UNPAID'
        : 'DRAFT'
      : unpaidTotal <= 0
        ? 'PAID'
        : 'PARTIAL';
  return prisma.payroll.update({
    where: { id: payrollId },
    data: { paidTotal, unpaidTotal, status },
  });
}

/**
 * 근무기록·수당·공제가 바뀌면 저장된 월 정산도 함께 맞춘다.
 *
 * 이미 지급이 시작된 정산(PARTIAL/PAID)은 금액을 함부로 바꾸지 않고 그대로 둔다.
 * 이 경우 화면에서 "재정산 필요" 로 표시되어 관리자가 직접 확인하게 한다.
 */
export async function syncPayrollForDate(employeeId: string, workDate: Date): Promise<void> {
  const year = workDate.getUTCFullYear();
  const month = workDate.getUTCMonth() + 1;

  const existing = await prisma.payroll.findUnique({
    where: { employeeId_year_month: { employeeId, year, month } },
  });
  if (!existing) return; // 아직 정산한 적 없으면 아무것도 하지 않는다.
  if (existing.status === 'PARTIAL' || existing.status === 'PAID') return;

  await upsertPayroll(employeeId, year, month, {
    confirm: existing.confirmedAt != null,
    adminId: existing.confirmedBy ?? undefined,
  });
}

/** 저장된 정산이 최신 계산과 다른지 (= 재정산이 필요한지) 확인한다. */
export function isPayrollStale(
  saved: { netTotal: number; grossTotal: number } | null | undefined,
  live: { netTotal: number; grossTotal: number },
): boolean {
  if (!saved) return false;
  return saved.netTotal !== live.netTotal || saved.grossTotal !== live.grossTotal;
}
