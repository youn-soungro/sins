import { getTodayOverview } from '@/lib/dashboard';
import { PageTitle, StatCard, Empty } from '@/components/ui';
import EmployeeStatusCards from '@/components/EmployeeStatusCards';
import { minutesToKorean, kstDateStr } from '@/lib/time';
import { won } from '@/lib/payroll';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const o = await getTodayOverview();
  const notIn = o.cards.filter((c) => c.state === 'NOT_CHECKED_IN');

  return (
    <>
      <PageTitle title="오늘 출근현황" desc={`${kstDateStr()} · 60초마다 자동 갱신됩니다.`} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="근무중" value={o.checkedIn} unit="명" tone="green" />
        <StatCard label="퇴근" value={o.checkedOut} unit="명" tone="slate" />
        <StatCard label="미출근" value={o.notCheckedIn} unit="명" tone="rose" />
        <StatCard label="오늘 인건비" value={won(o.estimatedCost)} unit="원" tone="blue" />
      </div>

      {notIn.length > 0 && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-sm font-black text-rose-800">
            미출근 {notIn.length}명
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {notIn.map((c) => (
              <span key={c.employeeId} className="badge bg-white text-rose-700">
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {o.cards.length === 0 ? (
        <Empty text="등록된 직원이 없습니다." />
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
