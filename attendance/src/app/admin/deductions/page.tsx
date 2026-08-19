import { prisma } from '@/lib/prisma';
import { PageTitle, Empty, StatCard } from '@/components/ui';
import { DEDUCTION_TYPE_LABEL } from '@/lib/labels';
import { won } from '@/lib/payroll';
import { dateOnlyStr, kstDateStr, dateOnly } from '@/lib/time';
import EntryManager from '@/components/EntryManager';

export const dynamic = 'force-dynamic';

export default async function DeductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; employeeId?: string }>;
}) {
  const sp = await searchParams;
  const today = kstDateStr();
  const from = sp.from ?? `${today.slice(0, 7)}-01`;
  const to = sp.to ?? today;
  const employeeId = sp.employeeId ?? 'ALL';

  const [rows, employees] = await Promise.all([
    prisma.deduction.findMany({
      where: {
        workDate: { gte: dateOnly(from), lte: dateOnly(to) },
        ...(employeeId !== 'ALL' ? { employeeId } : {}),
      },
      include: { employee: { select: { name: true } } },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    }),
    prisma.employee.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PageTitle
        title="공제관리"
        desc="선지급·가불·식대·숙박비·장비손실 등을 관리합니다. 공제사유는 반드시 입력해야 합니다."
        actions={
          <>
            <a href={`/api/excel?type=deductions&from=${from}&to=${to}`} className="btn-ghost">엑셀</a>
            <EntryManager kind="deduction" employees={employees} projects={[]} />
          </>
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" action="/admin/deductions">
        <input type="date" name="from" defaultValue={from} className="input max-w-[170px]" />
        <input type="date" name="to" defaultValue={to} className="input max-w-[170px]" />
        <select name="employeeId" defaultValue={employeeId} className="input max-w-[160px]">
          <option value="ALL">전체 직원</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button className="btn-primary">조회</button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="건수" value={rows.length} unit="건" />
        <StatCard label="공제 합계" value={won(total)} unit="원" tone="rose" />
      </div>

      {rows.length === 0 ? (
        <Empty text="해당 기간의 공제 내역이 없습니다." />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>날짜</th><th>직원</th><th>종류</th><th className="num">금액</th><th>공제사유</th><th>등록</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{dateOnlyStr(r.workDate)}</td>
                  <td className="font-bold">{r.employee.name}</td>
                  <td>{DEDUCTION_TYPE_LABEL[r.type]}</td>
                  <td className="num font-bold text-rose-600">-{won(r.amount)}</td>
                  <td className="max-w-[280px] whitespace-normal">{r.reason}</td>
                  <td className="text-xs text-slate-500">{r.createdBy ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
