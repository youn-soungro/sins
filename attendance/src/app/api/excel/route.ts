/**
 * 엑셀 다운로드.
 * type 파라미터로 8종 자료를 내려받는다.
 *   attendance / employee-attendance / monthly / payroll
 *   project-cost / allowances / deductions / payments
 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError, num, requireAdmin, str } from '@/lib/api';
import { buildWorkbook, excelResponse, type Column } from '@/lib/excel';
import { buildWhere } from '@/lib/attendance-filter';
import {
  dateOnly, dateOnlyStr, kstTimeStr, minutesToHours, monthRange, kstDateTimeStr, kstParts,
} from '@/lib/time';
import {
  ALLOWANCE_TYPE_LABEL, ATTENDANCE_STATUS_LABEL, DEDUCTION_TYPE_LABEL,
  PAYMENT_METHOD_LABEL, PAYROLL_STATUS_LABEL, WORKPLACE_TYPE_LABEL,
} from '@/lib/labels';
import { computePayroll } from '@/lib/payroll-service';
import { getProjectCost } from '@/lib/project-cost';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const type = str(sp.get('type')) ?? 'attendance';
    const stamp = new Date().toISOString().slice(0, 10);

    switch (type) {
      // ── 출퇴근 기록 (전체 / 직원별 — 필터만 다르다) ──────────
      case 'attendance':
      case 'employee-attendance': {
        const rows = await prisma.attendance.findMany({
          where: buildWhere(sp),
          include: { employee: true, workplace: true, project: true },
          orderBy: [{ workDate: 'asc' }, { checkInAt: 'asc' }],
        });
        const cols: Column[] = [
          { header: '날짜', key: 'date', width: 12 },
          { header: '직원번호', key: 'empNo', width: 10 },
          { header: '이름', key: 'name', width: 10 },
          { header: '구분', key: 'workType', width: 8 },
          { header: '근무지/현장', key: 'place', width: 22 },
          { header: '출근', key: 'in', width: 8 },
          { header: '퇴근', key: 'out', width: 8 },
          { header: '휴게(시간)', key: 'brk', width: 10, format: 'hours' },
          { header: '실근무(시간)', key: 'actual', width: 12, format: 'hours' },
          { header: '연장(시간)', key: 'ot', width: 10, format: 'hours' },
          { header: '기본급', key: 'basePay', width: 12, format: 'money' },
          { header: '연장수당', key: 'otPay', width: 12, format: 'money' },
          { header: '추가수당', key: 'allow', width: 12, format: 'money' },
          { header: '합계', key: 'total', width: 13, format: 'money' },
          { header: '상태', key: 'status', width: 10 },
          { header: '비고', key: 'memo', width: 24 },
        ];
        const data = rows.map((a) => ({
          date: dateOnlyStr(a.workDate),
          empNo: a.employee.empNo,
          name: a.employee.name,
          workType: WORKPLACE_TYPE_LABEL[a.workType],
          place: a.project?.name ?? a.workplace?.name ?? '-',
          in: kstTimeStr(a.checkInAt),
          out: kstTimeStr(a.checkOutAt),
          brk: minutesToHours(a.breakMinutes),
          actual: minutesToHours(a.actualMinutes),
          ot: minutesToHours(a.overtimeMinutes),
          basePay: a.basePay,
          otPay: a.overtimePay,
          allow: a.allowanceTotal,
          total: a.dayTotalPay,
          status: ATTENDANCE_STATUS_LABEL[a.status],
          memo: [a.adminMemo, a.isAutoClosed ? '자동마감' : ''].filter(Boolean).join(' / '),
        }));
        const name = type === 'employee-attendance' ? '직원별_출퇴근기록' : '전체_출퇴근기록';
        return excelResponse(
          await buildWorkbook('출퇴근기록', cols, data, { title: name.replace(/_/g, ' '), totalsRow: true }),
          `${name}_${stamp}.xlsx`,
        );
      }

      // ── 월별 근무현황 ────────────────────────────────
      case 'monthly': {
        const p = kstParts(new Date());
        const year = num(sp.get('year'), p.year);
        const month = num(sp.get('month'), p.month);
        const { start, end } = monthRange(year, month);
        const rows = await prisma.attendance.findMany({
          where: { workDate: { gte: start, lte: end } },
          include: { employee: true, workplace: true, project: true },
          orderBy: [{ workDate: 'asc' }, { employee: { name: 'asc' } }],
        });
        const cols: Column[] = [
          { header: '날짜', key: 'date', width: 12 },
          { header: '직원', key: 'name', width: 10 },
          { header: '근무지', key: 'place', width: 22 },
          { header: '출근', key: 'in', width: 8 },
          { header: '퇴근', key: 'out', width: 8 },
          { header: '실근무(시간)', key: 'actual', width: 12, format: 'hours' },
          { header: '연장(시간)', key: 'ot', width: 10, format: 'hours' },
          { header: '일당', key: 'basePay', width: 12, format: 'money' },
          { header: '수당', key: 'allow', width: 12, format: 'money' },
          { header: '합계', key: 'total', width: 13, format: 'money' },
        ];
        const data = rows.map((a) => ({
          date: dateOnlyStr(a.workDate),
          name: a.employee.name,
          place: a.project?.name ?? a.workplace?.name ?? '-',
          in: kstTimeStr(a.checkInAt),
          out: kstTimeStr(a.checkOutAt),
          actual: minutesToHours(a.actualMinutes),
          ot: minutesToHours(a.overtimeMinutes),
          basePay: a.basePay,
          allow: a.overtimePay + a.allowanceTotal,
          total: a.dayTotalPay,
        }));
        return excelResponse(
          await buildWorkbook('월별근무현황', cols, data, {
            title: `${year}년 ${month}월 근무현황`, totalsRow: true,
          }),
          `월별근무현황_${year}-${String(month).padStart(2, '0')}.xlsx`,
        );
      }

      // ── 직원별 급여정산 ──────────────────────────────
      case 'payroll': {
        const p = kstParts(new Date());
        const year = num(sp.get('year'), p.year);
        const month = num(sp.get('month'), p.month);
        const employees = await prisma.employee.findMany({
          where: { status: { in: ['ACTIVE', 'LEAVE'] } },
          orderBy: { name: 'asc' },
        });
        const summaries = await Promise.all(employees.map((e) => computePayroll(e.id, year, month)));
        const saved = await prisma.payroll.findMany({ where: { year, month } });
        const savedMap = new Map(saved.map((s) => [s.employeeId, s]));

        const cols: Column[] = [
          { header: '직원번호', key: 'empNo', width: 10 },
          { header: '이름', key: 'name', width: 10 },
          { header: '근무일', key: 'workDays', width: 8 },
          { header: '공장', key: 'factoryDays', width: 8 },
          { header: '현장', key: 'siteDays', width: 8 },
          { header: '기본근무(시간)', key: 'normalH', width: 13, format: 'hours' },
          { header: '연장근무(시간)', key: 'otH', width: 13, format: 'hours' },
          { header: '기본 일당 합계', key: 'base', width: 14, format: 'money' },
          { header: '연장수당', key: 'ot', width: 13, format: 'money' },
          { header: '야간수당', key: 'night', width: 12, format: 'money' },
          { header: '휴일수당', key: 'holiday', width: 12, format: 'money' },
          { header: '식대', key: 'meal', width: 11, format: 'money' },
          { header: '숙박비', key: 'lodging', width: 11, format: 'money' },
          { header: '차량비', key: 'vehicle', width: 11, format: 'money' },
          { header: '기타수당', key: 'other', width: 12, format: 'money' },
          { header: '지급 예정액', key: 'gross', width: 14, format: 'money' },
          { header: '공제', key: 'deduction', width: 12, format: 'money' },
          { header: '최종 지급액', key: 'net', width: 14, format: 'money' },
          { header: '지급액', key: 'paid', width: 13, format: 'money' },
          { header: '미지급', key: 'unpaid', width: 13, format: 'money' },
          { header: '상태', key: 'status', width: 10 },
        ];
        const data = summaries.map((s, i) => {
          const sv = savedMap.get(s.employeeId);
          return {
            empNo: employees[i].empNo,
            name: s.employeeName,
            workDays: s.workDays,
            factoryDays: s.factoryDays,
            siteDays: s.siteDays,
            normalH: minutesToHours(s.normalMinutes),
            otH: minutesToHours(s.overtimeMinutes),
            base: s.basePayTotal,
            ot: s.overtimePayTotal,
            night: s.nightPayTotal,
            holiday: s.holidayPayTotal,
            meal: s.mealTotal,
            lodging: s.lodgingTotal,
            vehicle: s.vehicleTotal,
            other: s.otherAllowanceTotal,
            gross: s.grossTotal,
            deduction: s.deductionTotal,
            net: s.netTotal,
            paid: sv?.paidTotal ?? 0,
            unpaid: sv ? sv.unpaidTotal : s.netTotal,
            status: sv ? PAYROLL_STATUS_LABEL[sv.status] : '미정산',
          };
        });
        return excelResponse(
          await buildWorkbook('급여정산', cols, data, {
            title: `${year}년 ${month}월 직원별 급여정산`, totalsRow: true,
          }),
          `급여정산_${year}-${String(month).padStart(2, '0')}.xlsx`,
        );
      }

      // ── 현장별 인건비 ────────────────────────────────
      case 'project-cost': {
        const from = str(sp.get('from'));
        const to = str(sp.get('to'));
        const list = await getProjectCost({ from, to });
        const cols: Column[] = [
          { header: '현장명', key: 'name', width: 26 },
          { header: '고객명', key: 'client', width: 16 },
          { header: '상태', key: 'status', width: 10 },
          { header: '투입 직원', key: 'workers', width: 10 },
          { header: '총 투입일(공수)', key: 'mandays', width: 14, format: 'hours' },
          { header: '기본 인건비', key: 'base', width: 14, format: 'money' },
          { header: '연장수당', key: 'ot', width: 13, format: 'money' },
          { header: '식대', key: 'meal', width: 12, format: 'money' },
          { header: '차량비', key: 'vehicle', width: 12, format: 'money' },
          { header: '기타수당', key: 'other', width: 12, format: 'money' },
          { header: '총 인건비', key: 'total', width: 15, format: 'money' },
        ];
        const data = list.map((p) => ({
          name: p.projectName,
          client: p.clientName ?? '-',
          status: p.status,
          workers: p.workerCount,
          mandays: p.mandays,
          base: p.basePay,
          ot: p.overtimePay,
          meal: p.mealTotal,
          vehicle: p.vehicleTotal,
          other: p.otherAllowance,
          total: p.totalCost,
        }));
        return excelResponse(
          await buildWorkbook('현장별인건비', cols, data, { title: '현장별 인건비', totalsRow: true }),
          `현장별인건비_${stamp}.xlsx`,
        );
      }

      // ── 추가수당 ─────────────────────────────────────
      case 'allowances': {
        const rows = await prisma.allowance.findMany({
          where: dateFilter(sp),
          include: { employee: true, project: true },
          orderBy: [{ workDate: 'asc' }],
        });
        const cols: Column[] = [
          { header: '날짜', key: 'date', width: 12 },
          { header: '직원', key: 'name', width: 10 },
          { header: '종류', key: 'type', width: 12 },
          { header: '금액', key: 'amount', width: 13, format: 'money' },
          { header: '현장', key: 'project', width: 22 },
          { header: '등록', key: 'by', width: 12 },
          { header: '메모', key: 'memo', width: 26 },
        ];
        const data = rows.map((a) => ({
          date: dateOnlyStr(a.workDate),
          name: a.employee.name,
          type: ALLOWANCE_TYPE_LABEL[a.type],
          amount: a.amount,
          project: a.project?.name ?? '-',
          by: a.isAuto ? '자동' : (a.createdBy ?? '-'),
          memo: a.memo ?? '',
        }));
        return excelResponse(
          await buildWorkbook('추가수당', cols, data, { title: '추가수당 내역', totalsRow: true }),
          `추가수당_${stamp}.xlsx`,
        );
      }

      // ── 공제내역 ─────────────────────────────────────
      case 'deductions': {
        const rows = await prisma.deduction.findMany({
          where: dateFilter(sp),
          include: { employee: true },
          orderBy: [{ workDate: 'asc' }],
        });
        const cols: Column[] = [
          { header: '날짜', key: 'date', width: 12 },
          { header: '직원', key: 'name', width: 10 },
          { header: '종류', key: 'type', width: 12 },
          { header: '금액', key: 'amount', width: 13, format: 'money' },
          { header: '공제사유', key: 'reason', width: 34 },
          { header: '등록', key: 'by', width: 12 },
        ];
        const data = rows.map((d) => ({
          date: dateOnlyStr(d.workDate),
          name: d.employee.name,
          type: DEDUCTION_TYPE_LABEL[d.type],
          amount: d.amount,
          reason: d.reason,
          by: d.createdBy ?? '-',
        }));
        return excelResponse(
          await buildWorkbook('공제내역', cols, data, { title: '공제 내역', totalsRow: true }),
          `공제내역_${stamp}.xlsx`,
        );
      }

      // ── 지급내역 ─────────────────────────────────────
      case 'payments': {
        const rows = await prisma.payment.findMany({
          include: { payroll: { include: { employee: true } } },
          orderBy: { paidAt: 'asc' },
        });
        const cols: Column[] = [
          { header: '지급일', key: 'paidAt', width: 18 },
          { header: '직원', key: 'name', width: 10 },
          { header: '정산기간', key: 'period', width: 14 },
          { header: '지급금액', key: 'amount', width: 14, format: 'money' },
          { header: '지급방법', key: 'method', width: 11 },
          { header: '최종 지급액', key: 'net', width: 14, format: 'money' },
          { header: '미지급금', key: 'unpaid', width: 13, format: 'money' },
          { header: '상태', key: 'status', width: 10 },
          { header: '메모', key: 'memo', width: 24 },
        ];
        const data = rows.map((p) => ({
          paidAt: kstDateTimeStr(p.paidAt),
          name: p.payroll.employee.name,
          period: `${p.payroll.year}-${String(p.payroll.month).padStart(2, '0')}`,
          amount: p.amount,
          method: PAYMENT_METHOD_LABEL[p.method],
          net: p.payroll.netTotal,
          unpaid: p.payroll.unpaidTotal,
          status: PAYROLL_STATUS_LABEL[p.payroll.status],
          memo: p.memo ?? '',
        }));
        return excelResponse(
          await buildWorkbook('지급내역', cols, data, { title: '급여 지급 내역', totalsRow: true }),
          `지급내역_${stamp}.xlsx`,
        );
      }

      default:
        return new Response(JSON.stringify({ ok: false, message: '알 수 없는 다운로드 종류입니다.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (e) {
    return handleError(e);
  }
}

function dateFilter(sp: URLSearchParams) {
  const from = str(sp.get('from'));
  const to = str(sp.get('to'));
  const employeeId = str(sp.get('employeeId'));
  return {
    ...(employeeId && employeeId !== 'ALL' ? { employeeId } : {}),
    ...(from || to
      ? { workDate: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } }
      : {}),
  };
}
