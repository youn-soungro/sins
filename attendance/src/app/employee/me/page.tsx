import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession, formatPhone } from '@/lib/auth';
import { EMPLOYEE_STATUS_LABEL, CALC_METHOD_LABEL } from '@/lib/labels';
import { dateOnlyStr } from '@/lib/time';
import { won } from '@/lib/payroll';
import LogoutButton from './logout-button';

export const dynamic = 'force-dynamic';

export default async function MyProfile() {
  const session = await getSession();
  if (!session?.employeeId) redirect('/employee/login');

  const emp = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: { payRates: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
  });
  if (!emp) redirect('/employee/login');

  const rate = emp.payRates[0];

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-black">{emp.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {emp.empNo} · {emp.jobType ?? '직종 미지정'}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="휴대폰번호" value={formatPhone(emp.phone)} />
          <Row label="입사일" value={dateOnlyStr(emp.hireDate)} />
          <Row label="재직상태" value={EMPLOYEE_STATUS_LABEL[emp.status]} />
          {emp.bankName && <Row label="계좌" value={`${emp.bankName} ${emp.bankAccount ?? ''}`} />}
        </dl>
      </div>

      {rate && (
        <div className="card">
          <h2 className="text-base font-black">내 단가</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="계산방식" value={CALC_METHOD_LABEL[rate.calcMethod]} />
            <Row label="공장 일당" value={`${won(rate.factoryDailyWage || rate.baseDailyWage)}원`} />
            <Row label="현장 일당" value={`${won(rate.siteDailyWage || rate.baseDailyWage)}원`} />
            {rate.overtimeHourlyRate > 0 && (
              <Row label="연장 시간당" value={`${won(rate.overtimeHourlyRate)}원`} />
            )}
            {rate.mealAllowance > 0 && <Row label="식대(일)" value={`${won(rate.mealAllowance)}원`} />}
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            단가 변경은 관리자에게 문의하세요.
          </p>
        </div>
      )}

      <LogoutButton />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-800">{value}</dd>
    </div>
  );
}
