import { PageTitle, StatCard, Empty } from '@/components/ui';
import { getProjectCost } from '@/lib/project-cost';
import { won } from '@/lib/payroll';
import { minutesToHoursLabel } from '@/lib/format';
import { kstDateStr } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function ProjectCostPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; projectId?: string }>;
}) {
  const sp = await searchParams;
  const today = kstDateStr();
  const from = sp.from ?? `${today.slice(0, 4)}-01-01`;
  const to = sp.to ?? today;

  const rows = await getProjectCost({ from, to, projectId: sp.projectId });
  const active = rows.filter((r) => r.workDays > 0);

  const totals = active.reduce(
    (s, r) => ({ cost: s.cost + r.totalCost, mandays: s.mandays + r.mandays }),
    { cost: 0, mandays: 0 },
  );

  return (
    <>
      <PageTitle
        title="현장별 인건비"
        desc="현장 원가계산에 사용할 수 있도록 투입 인원·공수·수당을 자동 집계합니다."
        actions={
          <a href={`/api/excel?type=project-cost&from=${from}&to=${to}`} className="btn-ghost">
            엑셀 다운로드
          </a>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" action="/admin/project-cost">
        <input type="date" name="from" defaultValue={from} className="input max-w-[170px]" />
        <input type="date" name="to" defaultValue={to} className="input max-w-[170px]" />
        <button className="btn-primary">조회</button>
      </form>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="집계 현장" value={active.length} unit="곳" />
        <StatCard label="총 투입 공수" value={totals.mandays.toFixed(1)} unit="공수" tone="blue" />
        <StatCard label="총 인건비" value={won(totals.cost)} unit="원" tone="green" />
      </div>

      {active.length === 0 ? (
        <Empty text="해당 기간에 인건비가 발생한 현장이 없습니다." />
      ) : (
        <div className="space-y-4">
          {active.map((r) => (
            <div key={r.projectId} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-black">{r.projectName}</h3>
                  <p className="text-sm text-slate-500">{r.clientName ?? '고객 미등록'} · {r.status}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-500">총 인건비</div>
                  <div className="text-2xl font-black text-brand-700">{won(r.totalCost)}원</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
                <Cell label="투입 직원" value={`${r.workerCount}명`} />
                <Cell label="총 투입일" value={`${r.mandays}공수`} />
                <Cell label="연장시간" value={minutesToHoursLabel(r.overtimeMinutes)} />
                <Cell label="기본 인건비" value={`${won(r.basePay)}원`} />
                <Cell label="연장수당" value={`${won(r.overtimePay)}원`} />
                <Cell label="식대" value={`${won(r.mealTotal)}원`} />
                <Cell label="차량비" value={`${won(r.vehicleTotal)}원`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-black text-slate-800">{value}</div>
    </div>
  );
}
