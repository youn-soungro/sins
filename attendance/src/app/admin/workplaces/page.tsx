import { prisma } from '@/lib/prisma';
import { PageTitle, Empty, Badge } from '@/components/ui';
import { WORKPLACE_TYPE_LABEL } from '@/lib/labels';
import WorkplaceManager from './manager';

export const dynamic = 'force-dynamic';

export default async function WorkplacesPage() {
  const rows = await prisma.workplace.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { attendances: true } } },
  });

  return (
    <>
      <PageTitle
        title="근무지관리"
        desc="근무지별 GPS 좌표와 허용반경을 설정합니다. 좌표를 비워두면 위치 검증을 하지 않습니다."
        actions={<WorkplaceManager mode="create" />}
      />

      {rows.length === 0 ? (
        <Empty text="등록된 근무지가 없습니다." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((w) => (
            <div key={w.id} className={`card ${w.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-black">{w.name}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{w.address ?? '주소 미등록'}</div>
                </div>
                <Badge code={w.type} text={WORKPLACE_TYPE_LABEL[w.type]} />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">허용반경</dt>
                  <dd className="font-bold">{w.radiusM}m</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">GPS 좌표</dt>
                  <dd className="font-mono text-xs">
                    {w.lat != null && w.lng != null ? `${w.lat.toFixed(5)}, ${w.lng.toFixed(5)}` : '미등록'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">근무기록</dt>
                  <dd className="font-bold">{w._count.attendances}건</dd>
                </div>
              </dl>
              <div className="mt-3 flex gap-2">
                <WorkplaceManager mode="edit" workplace={{
                  id: w.id, name: w.name, type: w.type, address: w.address ?? '',
                  lat: w.lat, lng: w.lng, radiusM: w.radiusM, isActive: w.isActive, memo: w.memo ?? '',
                }} />
                {w.lat != null && w.lng != null && (
                  <a
                    href={`https://map.kakao.com/link/map/${encodeURIComponent(w.name)},${w.lat},${w.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost text-xs"
                  >
                    지도보기
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
