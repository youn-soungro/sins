import { prisma } from '@/lib/prisma';
import { PageTitle, Empty } from '@/components/ui';
import { kstDateTimeStr } from '@/lib/time';

export const dynamic = 'force-dynamic';

const ENTITY_LABEL: Record<string, string> = {
  attendance: '출퇴근',
  breaks: '휴게',
  employees: '직원',
  employee_pay_rates: '단가',
  workplaces: '근무지',
  projects: '현장',
  allowances: '추가수당',
  deductions: '공제',
  payroll: '정산',
  payments: '지급',
  attendance_edit_requests: '수정요청',
  users: '계정',
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: '등록', UPDATE: '수정', DELETE: '삭제', LOGIN: '로그인',
  CHECK_IN: '출근', CHECK_OUT: '퇴근', BREAK_START: '휴게시작', BREAK_END: '휴게종료',
  APPROVE: '승인', REJECT: '반려', RESIGN: '퇴사처리', CONFIRM: '정산확정',
  CALCULATE: '정산계산', APPROVE_GPS: 'GPS승인', UPDATE_BY_REQUEST: '요청승인수정',
  UPSERT: '저장', DEACTIVATE: '사용중지', CLOSE: '완료처리', EMPLOYEE_CONFIRM: '직원확인',
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const entity = sp.entity ?? 'ALL';
  const page = Math.max(1, Number(sp.page) || 1);
  const take = 100;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: entity !== 'ALL' ? { entity } : {},
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
    }),
    prisma.auditLog.count({ where: entity !== 'ALL' ? { entity } : {} }),
  ]);

  return (
    <>
      <PageTitle
        title="수정이력 (Audit Log)"
        desc="모든 변경 이력은 삭제되지 않고 영구 보관됩니다."
      />

      <form className="mb-4 flex gap-2" action="/admin/audit">
        <select name="entity" defaultValue={entity} className="input max-w-[200px]">
          <option value="ALL">전체</option>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-primary">조회</button>
      </form>

      {rows.length === 0 ? (
        <Empty text="기록된 이력이 없습니다." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="tbl min-w-[900px]">
              <thead>
                <tr>
                  <th>시각</th><th>대상</th><th>작업</th><th>수정자</th>
                  <th>수정 전</th><th>수정 후</th><th>사유</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs">{kstDateTimeStr(r.createdAt)}</td>
                    <td>{ENTITY_LABEL[r.entity] ?? r.entity}</td>
                    <td className="font-bold">{ACTION_LABEL[r.action] ?? r.action}</td>
                    <td>{r.actorName ?? '-'}<span className="ml-1 text-xs text-slate-400">{r.actorRole === 'ADMIN' ? '관리자' : '직원'}</span></td>
                    <td className="max-w-[240px] truncate text-xs text-slate-500" title={JSON.stringify(r.beforeJson)}>
                      {r.beforeJson ? JSON.stringify(r.beforeJson) : '-'}
                    </td>
                    <td className="max-w-[240px] truncate text-xs text-slate-500" title={JSON.stringify(r.afterJson)}>
                      {r.afterJson ? JSON.stringify(r.afterJson) : '-'}
                    </td>
                    <td className="max-w-[200px] truncate">{r.reason ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            {page > 1 && (
              <a href={`/admin/audit?entity=${entity}&page=${page - 1}`} className="btn-ghost">‹ 이전</a>
            )}
            <span className="font-bold text-slate-600">
              {page} / {Math.max(1, Math.ceil(total / take))} 페이지 · 총 {total.toLocaleString('ko-KR')}건
            </span>
            {page * take < total && (
              <a href={`/admin/audit?entity=${entity}&page=${page + 1}`} className="btn-ghost">다음 ›</a>
            )}
          </div>
        </>
      )}
    </>
  );
}
