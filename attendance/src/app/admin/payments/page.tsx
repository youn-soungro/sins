import { prisma } from '@/lib/prisma';
import { PageTitle, StatCard, Empty, Badge } from '@/components/ui';
import { won } from '@/lib/payroll';
import { kstParts, kstDateTimeStr } from '@/lib/time';
import { PAYMENT_METHOD_LABEL, PAYROLL_STATUS_LABEL } from '@/lib/labels';
import PaymentForm from './payment-form';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const p = kstParts(new Date());
  const year = Number(sp.year) || p.year;
  const month = Number(sp.month) || p.month;

  const payrolls = await prisma.payroll.findMany({
    where: { year, month },
    include: {
      employee: { select: { name: true, empNo: true, bankName: true, bankAccount: true } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
    orderBy: { employee: { name: 'asc' } },
  });

  const totals = payrolls.reduce(
    (s, x) => ({ net: s.net + x.netTotal, paid: s.paid + x.paidTotal, unpaid: s.unpaid + x.unpaidTotal }),
    { net: 0, paid: 0, unpaid: 0 },
  );

  return (
    <>
      <PageTitle
        title="지급관리"
        desc="정산이 확정된 급여를 지급 처리하고 지급기록을 남깁니다."
        actions={
          <a href="/api/excel?type=payments" className="btn-ghost">엑셀 다운로드</a>
        }
      />

      <form className="mb-4 flex gap-2" action="/admin/payments">
        <input type="number" name="year" defaultValue={year} className="input max-w-[110px]" />
        <input type="number" name="month" defaultValue={month} min={1} max={12} className="input max-w-[90px]" />
        <button className="btn-primary">조회</button>
      </form>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="지급 대상액" value={won(totals.net)} unit="원" tone="blue" />
        <StatCard label="지급 완료" value={won(totals.paid)} unit="원" tone="green" />
        <StatCard label="미지급금" value={won(totals.unpaid)} unit="원" tone="rose" />
      </div>

      {payrolls.length === 0 ? (
        <Empty text={`${year}년 ${month}월 확정된 정산이 없습니다. 월별정산에서 먼저 정산을 실행하세요.`} />
      ) : (
        <div className="space-y-3">
          {payrolls.map((pr) => (
            <div key={pr.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black">{pr.employee.name}</span>
                    <Badge code={pr.status} text={PAYROLL_STATUS_LABEL[pr.status]} />
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {pr.year}년 {pr.month}월 · 근무 {pr.workDays}일
                    {pr.employee.bankName && ` · ${pr.employee.bankName} ${pr.employee.bankAccount ?? ''}`}
                  </div>
                  {pr.employeeConfirmedAt && (
                    <div className="mt-1 text-xs font-bold text-emerald-600">
                      ✔ 직원 확인 완료 ({kstDateTimeStr(pr.employeeConfirmedAt)})
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">최종 지급액</div>
                  <div className="text-xl font-black">{won(pr.netTotal)}원</div>
                  <div className="text-xs text-slate-500">
                    지급 {won(pr.paidTotal)} / 미지급{' '}
                    <b className={pr.unpaidTotal > 0 ? 'text-rose-600' : ''}>{won(pr.unpaidTotal)}</b>
                  </div>
                </div>
              </div>

              {pr.payments.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                  {pr.payments.map((pay) => (
                    <div key={pay.id} className="flex justify-between text-slate-600">
                      <span>{kstDateTimeStr(pay.paidAt)} · {PAYMENT_METHOD_LABEL[pay.method]}</span>
                      <span className="font-bold">{won(pay.amount)}원</span>
                    </div>
                  ))}
                </div>
              )}

              {pr.unpaidTotal > 0 && (
                <div className="mt-3">
                  <PaymentForm
                    payrollId={pr.id}
                    employeeName={pr.employee.name}
                    remaining={pr.unpaidTotal}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
