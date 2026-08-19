'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROJECT_STATUS_LABEL } from '@/lib/labels';

interface P {
  id: string; name: string; clientName: string; address: string; manager: string;
  managerPhone: string; startDate: string; endDate: string; status: string;
  memo: string; workplaceId: string;
}

export default function ProjectManager({
  mode,
  project,
  workplaces,
}: {
  mode: 'create' | 'edit';
  project?: P;
  workplaces: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: project?.name ?? '', clientName: project?.clientName ?? '', address: project?.address ?? '',
    manager: project?.manager ?? '', managerPhone: project?.managerPhone ?? '',
    startDate: project?.startDate ?? '', endDate: project?.endDate ?? '',
    status: project?.status ?? 'ONGOING', memo: project?.memo ?? '',
    workplaceId: project?.workplaceId ?? '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr('');
    try {
      const url = mode === 'create' ? '/api/projects' : `/api/projects/${project!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.message); return; }
      setOpen(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button className={mode === 'create' ? 'btn-primary' : 'btn-ghost text-xs'} onClick={() => setOpen(true)}>
        {mode === 'create' ? '+ 현장 등록' : '수정'}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-md rounded-2xl bg-white p-5">
        <h3 className="text-lg font-black">{mode === 'create' ? '현장 등록' : '현장 수정'}</h3>
        <div className="mt-4 space-y-3">
          <F label="현장명 *"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></F>
          <F label="고객명"><input className="input" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} /></F>
          <F label="주소"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></F>
          <div className="grid grid-cols-2 gap-2">
            <F label="담당자"><input className="input" value={f.manager} onChange={(e) => setF({ ...f, manager: e.target.value })} /></F>
            <F label="담당자 연락처"><input className="input" value={f.managerPhone} onChange={(e) => setF({ ...f, managerPhone: e.target.value })} /></F>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <F label="공사 시작일"><input type="date" className="input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></F>
            <F label="공사 종료일"><input type="date" className="input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></F>
          </div>
          <F label="현장 상태">
            <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
          <F label="연결 근무지 (GPS 반경 검증용)">
            <select className="input" value={f.workplaceId} onChange={(e) => setF({ ...f, workplaceId: e.target.value })}>
              <option value="">연결 안함</option>
              {workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </F>
          <F label="메모"><textarea className="input" rows={2} value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} /></F>
        </div>
        {err && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>취소</button>
          <button className="btn-primary" onClick={save} disabled={busy || !f.name}>저장</button>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
