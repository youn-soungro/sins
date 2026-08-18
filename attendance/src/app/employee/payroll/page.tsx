import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Empty } from '@/components/ui';
import { won } from '@/lib/payroll';
import { minutesToHoursLabel } from '@/lib/format';
import { kstDateTimeStr } from '@/lib/time';
import { PAYROLL_STATUS_LABEL } from '@/lib/labels';
import ConfirmButton from './confirm-button';

export const dynamic = 'force-dynamic';

export default async function MyPayroll() {
  const session = await getSession();
  if (!session?.employeeId) redirect('/employee/login');

  // 관리자가 확정한 정산만 직원에게 보여준다.
  const rows = await prisma.payroll.findMany({
    where: { employeeId: session.employeeId, confirmedAt: { not: null } },
    include: { payments: { orderBy: { paidAt: 'desc' } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  if (rows.length === 0) {
    return <Empty text="아직 확정된 정산 내역이 없습니다. 관리자가 정산을 완료하면 여기에 표시됩니다." />;
  }

  return (
    <div className="space-y-4">
      {rows.map((p) => (
        <div key={p.id} className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">{p.year}년 {p.month}월 정산</h2>
            <span className="badge bg-slate-100 text-slate-600">{PAYROLL_STATUS_LABEL[p.status]}</span>
          </div>

          <dl className="mt-4 space-y-2 text-base">
            <Row label="총 근무일" value={`${p.workDays}일`} />
            <Row label="총 근무시간" value={minutesToHoursLabel(p.normalMinutes + p.overtimeMinutes)} />
            <Row label="연장근무" value={minutesToHoursLabel(p.overtimeMinutes)} />
            <div className="!mt-3 border-t border-slate-100 pt-2" />
            <Row label="기본급" value={`${won(p.basePayTotal)}원`} />
            <Row
              label="추가수당"
              value={`${won(p.overtimePayTotal + p.nightPayTotal + p.holidayPayTotal + p.allowanceTotal)}원`}
            />
            <Row label="공제" value={`-${won(p.deductionTotal)}원`} tone="rose" />
          </dl>

          <div className="mt-4 rounded-xl bg-brand-50 px-4 py-4 text-center">
            <div className="text-sm font-bold text-brand-700">최종 지급액</div>
            <div className="mt-1 text-3xl font-black text-brand-800">{won(p.netTotal)}원</div>
            {p.paidTotal > 0 && (
              <div className="mt-2 text-xs font-bold text-slate-500">
                지급 완료 {won(p.paidTotal)}원
                {p.unpaidTotal > 0 && ` · 미지급 ${won(p.unpaidTotal)}원`}
              </div>
            )}
          </div>

          {p.employeeConfirmedAt ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-700">
              ✔ {kstDateTimeStr(p.employeeConfirmedAt)} 확인 완료
            </p>
          ) : (
            <div className="mt-4">
              <ConfirmButton payrollId={p.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'rose' }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-bold ${tone === 'rose' ? 'text-rose-600' : 'text-slate-800'}`}>{value}</dd>
    </div>
  );
}
