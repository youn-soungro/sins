import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { PageTitle, Empty, Badge } from '@/components/ui';
import { PROJECT_STATUS_LABEL } from '@/lib/labels';
import { dateOnlyStr } from '@/lib/time';
import ProjectManager from './manager';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const status = sp.status ?? 'ALL';

  const [rows, workplaces] = await Promise.all([
    prisma.project.findMany({
      where: {
        ...(status !== 'ALL' ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { clientName: { contains: q, mode: 'insensitive' as const } },
                { address: { contains: q, mode: 'insensitive' as const } },
                { manager: { contains: q, mode: 'insensitive' as const } },
                { memo: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { attendances: true } } },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    }),
    prisma.workplace.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageTitle
        title="현장관리"
        desc="외부 현장을 등록하면 직원이 출근할 때 현장을 선택할 수 있습니다."
        actions={<ProjectManager mode="create" workplaces={workplaces} />}
      />

      <form className="mb-4 flex flex-wrap gap-2" action="/admin/projects">
        <input name="q" defaultValue={q} placeholder="현장명 · 고객명 · 담당자 검색" className="input max-w-xs" />
        <select name="status" defaultValue={status} className="input max-w-[140px]">
          <option value="ALL">전체</option>
          {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-primary">검색</button>
      </form>

      {rows.length === 0 ? (
        <Empty text="등록된 현장이 없습니다." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-lg font-black">{p.name}</div>
                  <div className="mt-0.5 truncate text-sm text-slate-500">{p.clientName ?? '고객 미등록'}</div>
                </div>
                <Badge code={p.status} text={PROJECT_STATUS_LABEL[p.status]} />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <Row label="주소" value={p.address ?? '-'} />
                <Row label="담당자" value={p.manager ?? '-'} />
                <Row
                  label="공사기간"
                  value={`${p.startDate ? dateOnlyStr(p.startDate) : '-'} ~ ${p.endDate ? dateOnlyStr(p.endDate) : '-'}`}
                />
                <Row label="투입 기록" value={`${p._count.attendances}건`} />
              </dl>
              <div className="mt-3 flex gap-2">
                <ProjectManager
                  mode="edit"
                  workplaces={workplaces}
                  project={{
                    id: p.id, name: p.name, clientName: p.clientName ?? '', address: p.address ?? '',
                    manager: p.manager ?? '', managerPhone: p.managerPhone ?? '',
                    startDate: p.startDate ? dateOnlyStr(p.startDate) : '',
                    endDate: p.endDate ? dateOnlyStr(p.endDate) : '',
                    status: p.status, memo: p.memo ?? '', workplaceId: p.workplaceId ?? '',
                  }}
                />
                <Link href={`/admin/project-cost?projectId=${p.id}`} className="btn-ghost text-xs">
                  인건비 보기
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="truncate font-semibold text-slate-700">{value}</dd>
    </div>
  );
}
