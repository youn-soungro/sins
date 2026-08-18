import { prisma } from '@/lib/prisma';
import { PageTitle, Empty, Badge } from '@/components/ui';
import { EDIT_REQUEST_STATUS_LABEL } from '@/lib/labels';
import { dateOnlyStr, kstTimeStr, kstDateTimeStr } from '@/lib/time';
import RequestActions from './actions';

export const dynamic = 'force-dynamic';

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? 'PENDING';

  const rows = await prisma.attendanceEditRequest.findMany({
    where: status !== 'ALL' ? { status: status as never } : {},
    include: {
      employee: { select: { name: true, empNo: true } },
      attendance: { select: { workDate: true, checkInAt: true, checkOutAt: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });

  return (
    <>
      <PageTitle
        title="출퇴근 수정요청"
        desc="직원은 시간을 직접 바꿀 수 없고 요청만 가능합니다. 승인하면 기록이 변경되고 이력이 남습니다."
      />

      <form className="mb-4 flex gap-2" action="/admin/requests">
        <select name="status" defaultValue={status} className="input max-w-[160px]">
          <option value="PENDING">대기</option>
          <option value="APPROVED">승인</option>
          <option value="REJECTED">반려</option>
          <option value="ALL">전체</option>
        </select>
        <button className="btn-primary">조회</button>
      </form>

      {rows.length === 0 ? (
        <Empty text="해당 상태의 수정요청이 없습니다." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black">{r.employee.name}</span>
                    <Badge code={r.status} text={EDIT_REQUEST_STATUS_LABEL[r.status]} />
                  </div>
                  <div className="text-sm text-slate-500">
                    근무일 {dateOnlyStr(r.attendance.workDate)} · 요청 {kstDateTimeStr(r.createdAt)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-500">기존</div>
                  <div className="mt-1 font-bold">
                    출근 {kstTimeStr(r.currentCheckIn)} · 퇴근 {kstTimeStr(r.currentCheckOut)}
                  </div>
                </div>
                <div className="rounded-xl bg-brand-50 p-3">
                  <div className="text-xs font-bold text-brand-700">수정 요청</div>
                  <div className="mt-1 font-bold text-brand-800">
                    출근 {r.requestCheckIn ? kstTimeStr(r.requestCheckIn) : '변경없음'} · 퇴근{' '}
                    {r.requestCheckOut ? kstTimeStr(r.requestCheckOut) : '변경없음'}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                <span className="font-bold text-amber-800">사유 </span>
                <span className="text-amber-900">{r.reason}</span>
              </div>

              {r.status === 'PENDING' ? (
                <div className="mt-3">
                  <RequestActions requestId={r.id} employeeName={r.employee.name} />
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500">
                  {r.reviewedBy} 처리 · {r.reviewedAt ? kstDateTimeStr(r.reviewedAt) : ''}
                  {r.reviewMemo && ` · ${r.reviewMemo}`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
