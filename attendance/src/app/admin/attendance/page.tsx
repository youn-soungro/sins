import { prisma } from '@/lib/prisma';
import { PageTitle, Empty, Badge, StatCard } from '@/components/ui';
import { buildWhere } from '@/lib/attendance-filter';
import {
  ATTENDANCE_STATUS_LABEL, GPS_LABEL, WORKPLACE_TYPE_LABEL,
} from '@/lib/labels';
import { dateOnlyStr, kstTimeStr, minutesToKorean, kstDateStr } from '@/lib/time';
import { won } from '@/lib/payroll';
import AttendanceRowActions from './row-actions';

export const dynamic = 'force-dynamic';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v !== undefined) as [string, string][],
  );
  // 기본 조회기간: 이번 달
  const today = kstDateStr();
  const from = sp.from ?? `${today.slice(0, 7)}-01`;
  const to = sp.to ?? today;
  params.set('from', from);
  params.set('to', to);

  const [rows, employees, workplaces, projects] = await Promise.all([
    prisma.attendance.findMany({
      where: buildWhere(params),
      include: {
        employee: { select: { id: true, name: true, empNo: true } },
        workplace: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
      take: 500,
    }),
    prisma.employee.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.workplace.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.project.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const totals = rows.reduce(
    (s, r) => ({
      actual: s.actual + r.actualMinutes,
      ot: s.ot + r.overtimeMinutes,
      pay: s.pay + r.dayTotalPay,
    }),
    { actual: 0, ot: 0, pay: 0 },
  );

  const excelUrl = `/api/excel?type=attendance&${params.toString()}`;

  return (
    <>
      <PageTitle
        title="출퇴근 관리"
        desc="기간·직원·현장별로 조회하고, 관리자가 직접 수정할 수 있습니다. 모든 수정은 이력에 남습니다."
        actions={
          <a href={excelUrl} className="btn-ghost">
            엑셀 다운로드
          </a>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6" action="/admin/attendance">
        <input type="date" name="from" defaultValue={from} className="input" />
        <input type="date" name="to" defaultValue={to} className="input" />
        <select name="employeeId" defaultValue={sp.employeeId ?? 'ALL'} className="input">
          <option value="ALL">전체 직원</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select name="workplaceId" defaultValue={sp.workplaceId ?? 'ALL'} className="input">
          <option value="ALL">전체 근무지</option>
          {workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select name="projectId" defaultValue={sp.projectId ?? 'ALL'} className="input">
          <option value="ALL">전체 현장</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input name="q" defaultValue={sp.q ?? ''} placeholder="통합검색" className="input" />
          <button className="btn-primary shrink-0">조회</button>
        </div>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="조회 건수" value={rows.length} unit="건" />
        <StatCard label="실근무 합계" value={minutesToKorean(totals.actual)} tone="blue" />
        <StatCard label="연장 합계" value={minutesToKorean(totals.ot)} tone="amber" />
        <StatCard label="지급예정 합계" value={won(totals.pay)} unit="원" tone="green" />
      </div>

      {rows.length === 0 ? (
        <Empty text="해당 조건의 출퇴근 기록이 없습니다." />
      ) : (
        <div className="table-wrap">
          <table className="tbl min-w-[1100px]">
            <thead>
              <tr>
                <th>날짜</th><th>직원</th><th>구분</th><th>근무지/현장</th>
                <th>출근</th><th>퇴근</th><th className="num">실근무</th><th className="num">연장</th>
                <th className="num">일당</th><th className="num">수당</th><th className="num">합계</th>
                <th>상태</th><th>GPS</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.isAutoClosed ? 'bg-amber-50' : ''}>
                  <td>{dateOnlyStr(r.workDate)}</td>
                  <td className="font-bold">{r.employee.name}</td>
                  <td>{WORKPLACE_TYPE_LABEL[r.workType]}</td>
                  <td className="max-w-[200px] truncate">{r.project?.name ?? r.workplace?.name ?? '-'}</td>
                  <td>{kstTimeStr(r.checkInAt)}{r.isLate && <span className="ml-1 text-xs text-amber-600">지각</span>}</td>
                  <td>{kstTimeStr(r.checkOutAt)}{r.isAutoClosed && <span className="ml-1 text-xs text-rose-600">자동</span>}</td>
                  <td className="num">{minutesToKorean(r.actualMinutes)}</td>
                  <td className="num">{r.overtimeMinutes ? minutesToKorean(r.overtimeMinutes) : '-'}</td>
                  <td className="num">{won(r.basePay)}</td>
                  <td className="num">{won(r.overtimePay + r.allowanceTotal)}</td>
                  <td className="num font-bold">{won(r.dayTotalPay)}</td>
                  <td><Badge code={r.status} text={ATTENDANCE_STATUS_LABEL[r.status]} /></td>
                  <td>
                    <Badge code={r.checkInGps} text={GPS_LABEL[r.checkInGps]} />
                    {r.checkInDistanceM != null && (
                      <span className="ml-1 text-xs text-slate-400">{r.checkInDistanceM}m</span>
                    )}
                  </td>
                  <td>
                    <AttendanceRowActions
                      row={{
                        id: r.id,
                        employeeName: r.employee.name,
                        workDate: dateOnlyStr(r.workDate),
                        checkInAt: r.checkInAt?.toISOString() ?? null,
                        checkOutAt: r.checkOutAt?.toISOString() ?? null,
                        workType: r.workType,
                        gpsOutOfRange: r.checkInGps === 'OUT_OF_RANGE',
                      }}
                      workplaces={workplaces}
                      projects={projects}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
