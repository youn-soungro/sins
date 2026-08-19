import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { PageTitle, StatCard, Empty, Badge } from '@/components/ui';
import { computePayroll, isPayrollStale } from '@/lib/payroll-service';
import { won } from '@/lib/payroll';
import { minutesToHoursLabel } from '@/lib/format';
import { kstParts } from '@/lib/time';
import { PAYROLL_STATUS_LABEL } from '@/lib/labels';
import PayrollActions from './actions';

export const dynamic = 'force-dynamic';

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const p = kstParts(new Date());
  const year = Number(sp.year) || p.year;
  const month = Number(sp.month) || p.month;

  const employees = await prisma.employee.findMany({
    where: { status: { in: ['ACTIVE', 'LEAVE'] } },
    orderBy: { name: 'asc' },
  });
  const [summaries, saved] = await Promise.all([
    Promise.all(employees.map((e) => computePayroll(e.id, year, month))),
    prisma.payroll.findMany({ where: { year, month } }),
  ]);
  const savedMap = new Map(saved.map((s) => [s.employeeId, s]));

  const totals = summaries.reduce(
    (s, x) => ({
      gross: s.gross + x.grossTotal,
      deduction: s.deduction + x.deductionTotal,
      net: s.net + x.netTotal,
      days: s.days + x.workDays,
    }),
    { gross: 0, deduction: 0, net: 0, days: 0 },
  );

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <>
      <PageTitle
        title="월별정산"
        desc="월을 선택하고 '전체 정산 실행'만 누르면 근무일수·연장·수당·공제까지 자동 계산됩니다."
        actions={
          <>
            <a href={`/api/excel?type=payroll&year=${year}&month=${month}`} className="btn-ghost">
              엑셀 다운로드
            </a>
            <PayrollActions year={year} month={month} />
          </>
        }
      />

      <div className="mb-5 flex items-center justify-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <Link href={`/admin/payroll?year=${prev.y}&month=${prev.m}`} className="btn-ghost">‹ 이전달</Link>
        <span className="text-lg font-black">{year}년 {month}월</span>
        <Link href={`/admin/payroll?year=${next.y}&month=${next.m}`} className="btn-ghost">다음달 ›</Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="총 근무일" value={totals.days} unit="일" />
        <StatCard label="지급 예정액" value={won(totals.gross)} unit="원" tone="blue" />
        <StatCard label="공제 합계" value={won(totals.deduction)} unit="원" tone="rose" />
        <StatCard label="최종 지급액" value={won(totals.net)} unit="원" tone="green" />
      </div>

      {summaries.length === 0 ? (
        <Empty text="정산할 직원이 없습니다." />
      ) : (
        <div className="table-wrap">
          <table className="tbl min-w-[1200px]">
            <thead>
              <tr>
                <th>직원</th><th className="num">근무일</th><th className="num">공장</th><th className="num">현장</th>
                <th className="num">기본근무</th><th className="num">연장</th>
                <th className="num">일당 합계</th><th className="num">연장수당</th><th className="num">식대</th>
                <th className="num">기타수당</th><th className="num">지급예정</th><th className="num">공제</th>
                <th className="num">최종 지급액</th><th>상태</th><th></th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const sv = savedMap.get(s.employeeId);
                return (
                  <tr key={s.employeeId}>
                    <td className="font-bold">{s.employeeName}</td>
                    <td className="num">{s.workDays}</td>
                    <td className="num">{s.factoryDays}</td>
                    <td className="num">{s.siteDays}</td>
                    <td className="num">{minutesToHoursLabel(s.normalMinutes)}</td>
                    <td className="num">{minutesToHoursLabel(s.overtimeMinutes)}</td>
                    <td className="num">{won(s.basePayTotal)}</td>
                    <td className="num">{won(s.overtimePayTotal)}</td>
                    <td className="num">{won(s.mealTotal)}</td>
                    <td className="num">{won(s.lodgingTotal + s.vehicleTotal + s.otherAllowanceTotal)}</td>
                    <td className="num">{won(s.grossTotal)}</td>
                    <td className="num text-rose-600">{s.deductionTotal ? `-${won(s.deductionTotal)}` : '-'}</td>
                    <td className="num text-base font-black">{won(s.netTotal)}</td>
                    <td>
                      {sv ? <Badge code={sv.status} text={PAYROLL_STATUS_LABEL[sv.status]} />
                          : <Badge code="DRAFT" text="미정산" />}
                      {isPayrollStale(sv, s) && (
                        <span className="ml-1 badge bg-amber-100 text-amber-800" title="근무기록이 바뀌어 저장된 정산 금액과 다릅니다. 다시 정산해 주세요.">
                          재정산 필요
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/employees/${s.employeeId}?year=${year}&month=${month}`}
                        className="text-xs font-bold text-brand-600"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
