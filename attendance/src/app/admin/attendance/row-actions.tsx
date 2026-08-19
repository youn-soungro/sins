'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { utcToKstLocalInput } from '@/lib/time';
import { WORKPLACE_TYPE_LABEL } from '@/lib/labels';

interface Row {
  id: string;
  employeeName: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workType: 'FACTORY' | 'SITE' | 'ETC';
  gpsOutOfRange: boolean;
}

export default function AttendanceRowActions({
  row,
  workplaces,
  projects,
}: {
  row: Row;
  workplaces: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checkInAt, setCheckInAt] = useState(
    row.checkInAt ? utcToKstLocalInput(new Date(row.checkInAt)) : '',
  );
  const [checkOutAt, setCheckOutAt] = useState(
    row.checkOutAt ? utcToKstLocalInput(new Date(row.checkOutAt)) : '',
  );
  const [workType, setWorkType] = useState(row.workType);
  const [workplaceId, setWorkplaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!reason.trim()) {
      setErr('수정사유를 입력해 주세요.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/api/attendance/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInAt: checkInAt || undefined,
          checkOutAt: checkOutAt || null,
          workType,
          ...(workplaceId ? { workplaceId } : {}),
          ...(projectId ? { projectId } : {}),
          reason,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.message);
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function approveGps() {
    if (!confirm('반경을 벗어난 출근을 승인하시겠습니까?')) return;
    await fetch(`/api/attendance/${row.id}/approve-gps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '관리자 확인 완료' }),
    });
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-1">
        <button onClick={() => setOpen(true)} className="text-xs font-bold text-brand-600">
          수정
        </button>
        {row.gpsOutOfRange && (
          <button onClick={approveGps} className="text-xs font-bold text-emerald-600">
            승인
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black">출퇴근 기록 수정</h3>
            <p className="mt-1 text-sm text-slate-500">
              {row.employeeName} · {row.workDate}
            </p>

            <div className="mt-4 space-y-3 text-left">
              <div>
                <label className="label">출근시간</label>
                <input type="datetime-local" className="input" value={checkInAt} onChange={(e) => setCheckInAt(e.target.value)} />
              </div>
              <div>
                <label className="label">퇴근시간 (비우면 미퇴근)</label>
                <input type="datetime-local" className="input" value={checkOutAt} onChange={(e) => setCheckOutAt(e.target.value)} />
              </div>
              <div>
                <label className="label">근무 구분</label>
                <select className="input" value={workType} onChange={(e) => setWorkType(e.target.value as Row['workType'])}>
                  {Object.entries(WORKPLACE_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">근무지 변경 (선택)</label>
                <select className="input" value={workplaceId} onChange={(e) => setWorkplaceId(e.target.value)}>
                  <option value="">변경 안함</option>
                  {workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">현장 변경 (선택)</label>
                <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">변경 안함</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">수정사유 * (이력 보존용, 필수)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 현장에서 퇴근 버튼을 누르지 못해 관리자가 대신 입력"
                />
              </div>
            </div>

            {err && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)}>취소</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
