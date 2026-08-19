import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Empty } from '@/components/ui';
import { computePayroll } from '@/lib/payroll-service';
import { won } from '@/lib/payroll';
import { dateOnlyStr, kstTimeStr, minutesToKorean, kstParts, monthRange } from '@/lib/time';
import { WORKPLACE_TYPE_LABEL } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function MyRecords({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await getSession();
  if (!session?.employeeId) redirect('/employee/login');

  const sp = await searchParams;
  const p = kstParts(new Date());
  const year = Number(sp.year) || p.year;
  const month = Number(sp.month) || p.month;
  const { start, end } = monthRange(year, month);

  const [rows, summary] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId: session.employeeId, workDate: { gte: start, lte: end } },
      include: { workplace: true, project: true },
      orderBy: { workDate: 'desc' },
    }),
    computePayroll(session.employeeId, year, month),
  ]);

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-white p-3">
        <Link href={`/employee/records?year=${prev.y}&month=${prev.m}`} className="btn-ghost text-sm">‹ 이전</Link>
        <span className="text-lg font-black">{year}년 {month}월</span>
        <Link href={`/employee/records?year=${next.y}&month=${next.m}`} className="btn-ghost text-sm">다음 ›</Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Mini label="근무일" value={`${summary.workDays}일`} />
        <Mini label="연장근무" value={minutesToKorean(summary.overtimeMinutes)} />
        <Mini label="예상 지급액" value={`${won(summary.netTotal)}원`} highlight />
      </div>

      {rows.length === 0 ? (
        <Empty text="해당 월의 근무기록이 없습니다." />
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-center justify-between">
                <span className="font-black">{dateOnlyStr(a.workDate)}</span>
                <span className="badge bg-slate-100 text-slate-600">
                  {WORKPLACE_TYPE_LABEL[a.workType]}
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {a.project?.name ?? a.workplace?.name ?? '근무지 미지정'}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <Cell label="출근" value={kstTimeStr(a.checkInAt)} />
                <Cell label="퇴근" value={kstTimeStr(a.checkOutAt)} />
                <Cell label="실근무" value={minutesToKorean(a.actualMinutes)} />
                <Cell label="연장" value={a.overtimeMinutes ? minutesToKorean(a.overtimeMinutes) : '-'} />
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-sm text-slate-500">지급예정</span>
                <span className="text-lg font-black text-brand-700">{won(a.dayTotalPay)}원</span>
              </div>
              <Link
                href={`/employee/requests?attendanceId=${a.id}`}
                className="mt-2 block text-center text-xs font-bold text-brand-600"
              >
                시간이 다르면 수정 요청하기 →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'bg-brand-600 text-white' : 'bg-white'}`}>
      <div className={`text-xs font-bold ${highlight ? 'text-brand-100' : 'text-slate-500'}`}>{label}</div>
      <div className="mt-0.5 text-sm font-black">{value}</div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <span className="text-xs text-slate-500">{label} </span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
