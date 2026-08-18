import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Badge, Empty, PageTitle } from '@/components/ui';
import { EMPLOYEE_STATUS_LABEL, CALC_METHOD_LABEL } from '@/lib/labels';
import { formatPhone } from '@/lib/auth';
import { won } from '@/lib/payroll';
import { dateOnlyStr } from '@/lib/time';
import EmployeeCreateButton from './create-button';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const status = sp.status ?? 'ACTIVE';

  const employees = await prisma.employee.findMany({
    where: {
      ...(status !== 'ALL' ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q.replace(/\D/g, '') || q } },
              { empNo: { contains: q, mode: 'insensitive' as const } },
              { jobType: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    include: { payRates: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageTitle
        title="직원관리"
        desc="직원 등록·수정·퇴사처리와 직원별 일당을 관리합니다."
        actions={<EmployeeCreateButton />}
      />

      <form className="mb-4 flex flex-wrap gap-2" action="/admin/employees">
        <input
          name="q"
          defaultValue={q}
          placeholder="이름 · 번호 · 직종 검색"
          className="input max-w-xs"
        />
        <select name="status" defaultValue={status} className="input max-w-[140px]">
          <option value="ACTIVE">재직</option>
          <option value="LEAVE">휴직</option>
          <option value="RESIGNED">퇴사</option>
          <option value="ALL">전체</option>
        </select>
        <button className="btn-primary">검색</button>
      </form>

      {employees.length === 0 ? (
        <Empty text="등록된 직원이 없습니다. 우측 상단의 '직원 등록'을 눌러 추가하세요." />
      ) : (
        <>
          {/* PC: 표 */}
          <div className="table-wrap hidden md:block">
            <table className="tbl">
              <thead>
                <tr>
                  <th>직원번호</th>
                  <th>이름</th>
                  <th>휴대폰</th>
                  <th>직종</th>
                  <th>입사일</th>
                  <th>상태</th>
                  <th className="num">공장 일당</th>
                  <th className="num">현장 일당</th>
                  <th>계산방식</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const r = e.payRates[0];
                  return (
                    <tr key={e.id}>
                      <td className="font-mono text-xs">{e.empNo}</td>
                      <td className="font-bold">{e.name}</td>
                      <td>{formatPhone(e.phone)}</td>
                      <td>{e.jobType ?? '-'}</td>
                      <td>{dateOnlyStr(e.hireDate)}</td>
                      <td><Badge code={e.status} text={EMPLOYEE_STATUS_LABEL[e.status]} /></td>
                      <td className="num">{won(r?.factoryDailyWage || r?.baseDailyWage)}</td>
                      <td className="num">{won(r?.siteDailyWage || r?.baseDailyWage)}</td>
                      <td className="text-xs">{r ? CALC_METHOD_LABEL[r.calcMethod] : '-'}</td>
                      <td>
                        <Link href={`/admin/employees/${e.id}`} className="font-bold text-brand-600">
                          상세
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일: 카드 */}
          <div className="grid gap-3 md:hidden">
            {employees.map((e) => {
              const r = e.payRates[0];
              return (
                <Link key={e.id} href={`/admin/employees/${e.id}`} className="card block">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black">{e.name}</span>
                    <Badge code={e.status} text={EMPLOYEE_STATUS_LABEL[e.status]} />
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatPhone(e.phone)} · {e.jobType ?? '직종 미지정'}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <span className="text-xs text-slate-500">공장 </span>
                      <span className="font-bold">{won(r?.factoryDailyWage || r?.baseDailyWage)}원</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <span className="text-xs text-slate-500">현장 </span>
                      <span className="font-bold">{won(r?.siteDailyWage || r?.baseDailyWage)}원</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
