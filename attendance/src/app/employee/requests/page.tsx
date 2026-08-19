import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Badge, Empty } from '@/components/ui';
import { EDIT_REQUEST_STATUS_LABEL } from '@/lib/labels';
import { dateOnlyStr, kstTimeStr, kstDateTimeStr, utcToKstLocalInput } from '@/lib/time';
import RequestForm from './form';

export const dynamic = 'force-dynamic';

export default async function MyRequests({
  searchParams,
}: {
  searchParams: Promise<{ attendanceId?: string }>;
}) {
  const session = await getSession();
  if (!session?.employeeId) redirect('/employee/login');
  const sp = await searchParams;

  // 최근 30일 근무기록 중에서 수정요청 대상을 고른다.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [records, requests] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId: session.employeeId, workDate: { gte: since } },
      orderBy: { workDate: 'desc' },
      select: { id: true, workDate: true, checkInAt: true, checkOutAt: true },
    }),
    prisma.attendanceEditRequest.findMany({
      where: { employeeId: session.employeeId },
      include: { attendance: { select: { workDate: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black">출퇴근 수정요청</h1>
        <p className="mt-1 text-sm text-slate-500">
          출퇴근 시간은 직접 바꿀 수 없습니다. 요청하면 관리자가 확인 후 변경합니다.
        </p>
      </div>

      <RequestForm
        records={records.map((r) => ({
          id: r.id,
          workDate: dateOnlyStr(r.workDate),
          checkIn: kstTimeStr(r.checkInAt),
          checkOut: kstTimeStr(r.checkOutAt),
          checkInInput: r.checkInAt ? utcToKstLocalInput(r.checkInAt) : '',
          checkOutInput: r.checkOutAt ? utcToKstLocalInput(r.checkOutAt) : '',
        }))}
        preselectId={sp.attendanceId ?? ''}
      />

      <div>
        <h2 className="mb-2 text-base font-black">내 요청 내역</h2>
        {requests.length === 0 ? (
          <Empty text="요청 내역이 없습니다." />
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between">
                  <span className="font-black">{dateOnlyStr(r.attendance.workDate)}</span>
                  <Badge code={r.status} text={EDIT_REQUEST_STATUS_LABEL[r.status]} />
                </div>
                <div className="mt-2 text-sm">
                  <div className="text-slate-500">
                    기존 {kstTimeStr(r.currentCheckIn)} ~ {kstTimeStr(r.currentCheckOut)}
                  </div>
                  <div className="font-bold text-brand-700">
                    요청 {r.requestCheckIn ? kstTimeStr(r.requestCheckIn) : '변경없음'} ~{' '}
                    {r.requestCheckOut ? kstTimeStr(r.requestCheckOut) : '변경없음'}
                  </div>
                </div>
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{r.reason}</div>
                {r.reviewedAt && (
                  <div className="mt-2 text-xs text-slate-400">
                    {kstDateTimeStr(r.reviewedAt)} {r.reviewedBy} 처리
                    {r.reviewMemo && ` · ${r.reviewMemo}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
