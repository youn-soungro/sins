import Link from 'next/link';
import { getTodayOverview } from '@/lib/dashboard';
import { prisma } from '@/lib/prisma';
import { StatCard, PageTitle, Empty } from '@/components/ui';
import { won } from '@/lib/payroll';
import { kstDateStr, kstDateKorean, minutesToKorean } from '@/lib/time';
import EmployeeStatusCards from '@/components/EmployeeStatusCards';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const o = await getTodayOverview();
  const [pendingRequests, unpaidCount] = await Promise.all([
    prisma.attendanceEditRequest.count({ where: { status: 'PENDING' } }),
    prisma.payroll.count({ where: { status: { in: ['UNPAID', 'PARTIAL'] } } }),
  ]);

  return (
    <>
      <PageTitle
        title="오늘 근무현황"
        desc={`${kstDateStr()} ${kstDateKorean(new Date())} 기준`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="전체 직원" value={o.totalEmployees} unit="명" />
        <StatCard label="출근(근무중)" value={o.checkedIn} unit="명" tone="green" />
        <StatCard label="퇴근" value={o.checkedOut} unit="명" tone="slate" />
        <StatCard label="미출근" value={o.notCheckedIn} unit="명" tone="rose" />
        <StatCard label="공장근무" value={o.factoryCount} unit="명" tone="blue" />
        <StatCard label="현장근무" value={o.siteCount} unit="명" tone="amber" />
        <StatCard label="지각" value={o.lateCount} unit="명" tone={o.lateCount ? 'amber' : 'slate'} />
        <StatCard label="연장근무" value={o.overtimeCount} unit="명" tone="blue" />
      </div>

      <div className="mb-6 rounded-2xl bg-brand-700 p-5 text-white">
        <div className="text-sm font-bold text-brand-100">오늘 예상 인건비</div>
        <div className="mt-1 text-3xl font-black tabular-nums sm:text-4xl">
          {won(o.estimatedCost)}<span className="ml-1 text-xl">원</span>
        </div>
        <div className="mt-1 text-xs text-brand-200">
          퇴근 전 직원은 현재 시각까지의 근무시간으로 계산한 금액입니다.
        </div>
      </div>

      {(pendingRequests > 0 || unpaidCount > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {pendingRequests > 0 && (
            <Link href="/admin/requests" className="card flex-1 border-amber-200 bg-amber-50">
              <div className="text-sm font-bold text-amber-800">
                ✉️ 승인 대기중인 출퇴근 수정요청 <b>{pendingRequests}건</b>
              </div>
            </Link>
          )}
          {unpaidCount > 0 && (
            <Link href="/admin/payments" className="card flex-1 border-rose-200 bg-rose-50">
              <div className="text-sm font-bold text-rose-800">
                💳 미지급/일부지급 정산 <b>{unpaidCount}건</b>
              </div>
            </Link>
          )}
        </div>
      )}

      <h2 className="mb-3 text-base font-black text-slate-800">실시간 직원 현황</h2>
      {o.cards.length === 0 ? (
        <Empty text="등록된 직원이 없습니다. 직원관리에서 먼저 직원을 등록하세요." />
      ) : (
        <EmployeeStatusCards
          cards={o.cards.map((c) => ({
            ...c,
            checkIn: c.checkIn ? c.checkIn.toISOString() : null,
            checkOut: c.checkOut ? c.checkOut.toISOString() : null,
            liveLabel: minutesToKorean(c.liveMinutes),
          }))}
        />
      )}
    </>
  );
}
