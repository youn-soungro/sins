'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WORKPLACE_TYPE_LABEL } from '@/lib/labels';

interface WP {
  id: string; name: string; type: string; address: string;
  lat: number | null; lng: number | null; radiusM: number; isActive: boolean; memo: string;
}

export default function WorkplaceManager({
  mode,
  workplace,
}: {
  mode: 'create' | 'edit';
  workplace?: WP;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: workplace?.name ?? '',
    type: workplace?.type ?? 'SITE',
    address: workplace?.address ?? '',
    lat: workplace?.lat != null ? String(workplace.lat) : '',
    lng: workplace?.lng != null ? String(workplace.lng) : '',
    radiusM: String(workplace?.radiusM ?? 200),
    isActive: workplace?.isActive ?? true,
    memo: workplace?.memo ?? '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  /** 관리자가 근무지에서 직접 좌표를 찍을 수 있게 한다. */
  function useMyLocation() {
    if (!navigator.geolocation) {
      setErr('이 브라우저에서는 위치를 가져올 수 없습니다.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setF((v) => ({ ...v, lat: String(p.coords.latitude), lng: String(p.coords.longitude) })),
      () => setErr('위치 정보를 가져오지 못했습니다. 브라우저 위치 권한을 확인하세요.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function save() {
    setBusy(true); setErr('');
    try {
      const url = mode === 'create' ? '/api/workplaces' : `/api/workplaces/${workplace!.id}`;
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
        {mode === 'create' ? '+ 근무지 등록' : '수정'}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h3 className="text-lg font-black">{mode === 'create' ? '근무지 등록' : '근무지 수정'}</h3>
        <div className="mt-4 space-y-3">
          <div><label className="label">근무지명 *</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label">구분</label>
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {Object.entries(WORKPLACE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label className="label">주소</label>
            <input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">위도</label>
              <input className="input" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} placeholder="37.32190" /></div>
            <div><label className="label">경도</label>
              <input className="input" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} placeholder="126.83090" /></div>
          </div>
          <button className="btn-ghost w-full text-xs" onClick={useMyLocation}>
            📍 현재 위치 좌표 가져오기 (근무지에서 실행하세요)
          </button>
          <div><label className="label">허용반경 (m)</label>
            <input className="input text-right" inputMode="numeric" value={f.radiusM}
              onChange={(e) => setF({ ...f, radiusM: e.target.value })} /></div>
          {mode === 'edit' && (
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" className="h-5 w-5" checked={f.isActive}
                onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
              사용중
            </label>
          )}
          <div><label className="label">메모</label>
            <textarea className="input" rows={2} value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} /></div>
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
