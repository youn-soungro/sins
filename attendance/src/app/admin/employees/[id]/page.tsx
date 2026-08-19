import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageTitle, StatCard, Badge, Empty } from '@/components/ui';
import { computePayroll } from '@/lib/payroll-service';
import { won, minutesToHoursLabel } from '@/lib/format';
import { formatPhone } from '@/lib/auth';
import {
  CALC_METHOD_LABEL, EMPLOYEE_STATUS_LABEL, WORKPLACE_TYPE_LABEL,
} from '@/lib/labels';
import { dateOnlyStr, kstParts, kstTimeStr, minutesToKorean, monthRange } from '@/lib/time';
import WorkCalendar from '@/components/WorkCalendar';
import EmployeeEditPanel from './edit-panel';

export const dynamic = 'force-dynamic';

export default async function EmployeeDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const nowP = kstParts(new Date());
  const year = Number(sp.year) || nowP.year;
  const month = Number(sp.month) || nowP.month;

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      payRates: { orderBy: { effectiveFrom: 'desc' } },
      user: { select: { loginId: true, lastLoginAt: true, isActive: true } },
    },
  });
  if (!employee) notFound();

  const { start, end } = monthRange(year, month);
  const [summary, attendances, deductions] = await Promise.all([
    computePayroll(id, year, month),
    prisma.attendance.findMany({
      where: { employeeId: id, workDate: { gte: start, lte: end } },
      include: { workplace: true, project: true, breaks: true },
      orderBy: { workDate: 'asc' },
    }),
    prisma.deduction.findMany({
      where: { employeeId: id, workDate: { gte: start, lte: end } },
      orderBy: { workDate: 'asc' },
    }),
  ]);

  const rate = employee.payRates[0];
  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <>
      <PageTitle
        title={`${employee.name} (${employee.empNo})`}
        desc={`${formatPhone(employee.phone)} · ${employee.jobType ?? '직종 미지정'} · 입사 ${dateOnlyStr(employee.hireDate)}`}
        actions={
          <>
            <Badge code={employee.status} text={EMPLOYEE_STATUS_LABEL[employee.status]} />
            <Link href="/admin/employees" className="btn-ghost">목록</Link>
          </>
        }
      />

      {/* 월 선택 */}
      <div className="mb-5 flex items-center justify-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <Link href={`/admin/employees/${id}?year=${prevMonth.y}&month=${prevMonth.m}`} className="btn-ghost">‹ 이전달</Link>
        <span className="text-lg font-black">{year}년 {month}월</span>
        <Link href={`/admin/employees/${id}?year=${nextMonth.y}&month=${nextMonth.m}`} className="btn-ghost">다음달 ›</Link>
      </div>

      {/* 월 정산 요약 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="근무일" value={summary.workDays} unit="일" />
        <StatCard label="공장근무" value={summary.factoryDays} unit="일" tone="blue" />
        <StatCard label="현장근무" value={summary.siteDays} unit="일" tone="amber" />
        <StatCard label="기본근무" value={minutesToHoursLabel(summary.normalMinutes)} tone="slate" />
        <StatCard label="연장근무" value={minutesToHoursLabel(summary.overtimeMinutes)} tone="slate" />
        <StatCard label="최종 지급액" value={won(summary.netTotal)} unit="원" tone="green" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-base font-black">{year}년 {month}월 정산 내역</h2>
          <dl className="space-y-1.5 text-sm">
            <Line label="기본 일당 합계" value={summary.basePayTotal} />
            <Line label="연장수당" value={summary.overtimePayTotal} />
            {summary.nightPayTotal > 0 && <Line label="야간수당" value={summary.nightPayTotal} />}
            {summary.holidayPayTotal > 0 && <Line label="휴일수당" value={summary.holidayPayTotal} />}
            <Line label="식대" value={summary.mealTotal} />
            <Line label="숙박비" value={summary.lodgingTotal} />
            <Line label="차량비" value={summary.vehicleTotal} />
            <Line label="기타수당" value={summary.otherAllowanceTotal} />
            <div className="!mt-3 border-t border-slate-200 pt-2">
              <Line label="지급 예정금액" value={summary.grossTotal} bold />
            </div>
            <Line label="공제" value={-summary.deductionTotal} tone="rose" />
            <div className="!mt-3 rounded-xl bg-brand-50 px-3 py-2.5">
              <Line label="최종 지급액" value={summary.netTotal} bold big />
            </div>
          </dl>
        </div>

        <div className="card">
          <h2 className="mb-3 text-base font-black">적용 단가</h2>
          {rate ? (
            <dl className="space-y-1.5 text-sm">
              <Text label="계산방식" value={CALC_METHOD_LABEL[rate.calcMethod]} />
              <Line label="기본 일당" value={rate.baseDailyWage} />
              <Line label="공장 일당" value={rate.factoryDailyWage} />
              <Line label="현장 일당" value={rate.siteDailyWage} />
              <Line label="연장 시간당" value={rate.overtimeHourlyRate} />
              <Line label="야간 시간당" value={rate.nightHourlyRate} />
              <Line label="휴일 시간당" value={rate.holidayHourlyRate} />
              <Line label="식대(일)" value={rate.mealAllowance} />
              <Line label="숙박비(일)" value={rate.lodgingAllowance} />
              <Line label="차량비(일)" value={rate.vehicleAllowance} />
              <Line label="기타수당(일)" value={rate.otherAllowance} />
              <Text label="적용 시작일" value={dateOnlyStr(rate.effectiveFrom)} />
            </dl>
          ) : (
            <Empty text="등록된 단가가 없습니다." />
          )}
          <div className="mt-4">
            <EmployeeEditPanel
              employee={{
                id: employee.id,
                empNo: employee.empNo,
                name: employee.name,
                phone: employee.phone,
                jobType: employee.jobType,
                hireDate: dateOnlyStr(employee.hireDate),
                resignDate: employee.resignDate ? dateOnlyStr(employee.resignDate) : '',
                status: employee.status,
                bankName: employee.bankName,
                bankAccount: employee.bankAccount,
                memo: employee.memo,
              }}
              currentRate={
                rate
                  ? {
                      calcMethod: rate.calcMethod,
                      baseDailyWage: rate.baseDailyWage,
                      factoryDailyWage: rate.factoryDailyWage,
                      siteDailyWage: rate.siteDailyWage,
                      overtimeHourlyRate: rate.overtimeHourlyRate,
                      nightHourlyRate: rate.nightHourlyRate,
                      holidayHourlyRate: rate.holidayHourlyRate,
                      mealAllowance: rate.mealAllowance,
                      lodgingAllowance: rate.lodgingAllowance,
                      vehicleAllowance: rate.vehicleAllowance,
                      otherAllowance: rate.otherAllowance,
                    }
                  : null
              }
              year={year}
              month={month}
            />
          </div>
        </div>
      </div>

      {/* 근무 캘린더 */}
      <h2 className="mb-3 text-base font-black text-slate-800">근무 캘린더</h2>
      <div className="mb-6">
        <WorkCalendar
          year={year}
          month={month}
          days={attendances.map((a) => ({
            date: dateOnlyStr(a.workDate),
            workType: a.workType,
            status: a.status,
            checkIn: kstTimeStr(a.checkInAt),
            checkOut: kstTimeStr(a.checkOutAt),
            actualMinutes: a.actualMinutes,
            overtimeMinutes: a.overtimeMinutes,
            dayTotalPay: a.dayTotalPay,
            placeName: a.project?.name ?? a.workplace?.name ?? null,
          }))}
        />
      </div>

      {/* 근무내역 표 */}
      <h2 className="mb-3 text-base font-black text-slate-800">근무 내역</h2>
      {attendances.length === 0 ? (
        <Empty text="해당 월의 근무기록이 없습니다." />
      ) : (
        <div className="table-wrap mb-6">
          <table className="tbl">
            <thead>
              <tr>
                <th>날짜</th><th>구분</th><th>근무지/현장</th><th>출근</th><th>퇴근</th>
                <th className="num">휴게</th><th className="num">실근무</th><th className="num">연장</th>
                <th className="num">일당</th><th className="num">수당</th><th className="num">합계</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((a) => (
                <tr key={a.id}>
                  <td>{dateOnlyStr(a.workDate)}</td>
                  <td>{WORKPLACE_TYPE_LABEL[a.workType]}</td>
                  <td className="max-w-[180px] truncate">{a.project?.name ?? a.workplace?.name ?? '-'}</td>
                  <td>{kstTimeStr(a.checkInAt)}</td>
                  <td>{kstTimeStr(a.checkOutAt)}</td>
                  <td className="num">{a.breakMinutes ? minutesToKorean(a.breakMinutes) : '-'}</td>
                  <td className="num">{minutesToKorean(a.actualMinutes)}</td>
                  <td className="num">{a.overtimeMinutes ? minutesToKorean(a.overtimeMinutes) : '-'}</td>
                  <td className="num">{won(a.basePay)}</td>
                  <td className="num">{won(a.overtimePay + a.allowanceTotal)}</td>
                  <td className="num font-bold">{won(a.dayTotalPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deductions.length > 0 && (
        <>
          <h2 className="mb-3 text-base font-black text-slate-800">공제 내역</h2>
          <div className="table-wrap">
            <table className="tbl min-w-0">
              <thead>
                <tr><th>날짜</th><th className="num">금액</th><th>사유</th></tr>
              </thead>
              <tbody>
                {deductions.map((d) => (
                  <tr key={d.id}>
                    <td>{dateOnlyStr(d.workDate)}</td>
                    <td className="num text-rose-600">-{won(d.amount)}</td>
                    <td className="whitespace-normal">{d.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Line({
  label, value, bold, big, tone,
}: { label: string; value: number; bold?: boolean; big?: boolean; tone?: 'rose' }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`tabular-nums ${bold ? 'font-black' : 'font-semibold'} ${
          big ? 'text-xl' : ''
        } ${tone === 'rose' ? 'text-rose-600' : 'text-slate-800'}`}
      >
        {won(value)}원
      </dd>
    </div>
  );
}

function Text({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
