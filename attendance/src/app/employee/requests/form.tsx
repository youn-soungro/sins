'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Rec {
  id: string; workDate: string; checkIn: string; checkOut: string;
  checkInInput: string; checkOutInput: string;
}

export default function RequestForm({
  records,
  preselectId,
}: {
  records: Rec[];
  preselectId: string;
}) {
  const router = useRouter();
  const initial = records.find((r) => r.id === preselectId) ?? records[0];
  const [attendanceId, setAttendanceId] = useState(initial?.id ?? '');
  const [checkIn, setCheckIn] = useState(initial?.checkInInput ?? '');
  const [checkOut, setCheckOut] = useState(initial?.checkOutInput ?? '');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = records.find((r) => r.id === attendanceId);

  function pick(id: string) {
    setAttendanceId(id);
    const r = records.find((x) => x.id === id);
    setCheckIn(r?.checkInInput ?? '');
    setCheckOut(r?.checkOutInput ?? '');
  }

  async function submit() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId,
          requestCheckIn: checkIn || null,
          requestCheckOut: checkOut || null,
          reason,
        }),
      });
      const j = await res.json();
      setMsg(j.ok ? '수정요청이 접수되었습니다. 관리자 승인 후 반영됩니다.' : j.message);
      if (j.ok) { setReason(''); router.refresh(); }
    } finally { setBusy(false); }
  }

  if (records.length === 0) {
    return (
      <div className="card text-center text-sm text-slate-500">
        최근 30일 내 근무기록이 없어 수정요청할 수 없습니다.
      </div>
    );
  }

  return (
    <div className="card">
      <label className="label">수정할 근무일</label>
      <select className="input" value={attendanceId} onChange={(e) => pick(e.target.value)}>
        {records.map((r) => (
          <option key={r.id} value={r.id}>
            {r.workDate} ({r.checkIn} ~ {r.checkOut})
          </option>
        ))}
      </select>

      {selected && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          기존 기록 · 출근 {selected.checkIn} / 퇴근 {selected.checkOut}
        </p>
      )}

      <label className="label mt-4">요청 출근시간</label>
      <input type="datetime-local" className="input" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />

      <label className="label mt-3">요청 퇴근시간</label>
      <input type="datetime-local" className="input" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />

      <label className="label mt-3">사유 * (필수)</label>
      <textarea
        className="input"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="예: 현장에서 퇴근 버튼을 누르지 못했습니다."
      />

      {msg && <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{msg}</p>}

      <button
        className="btn-primary mt-4 w-full py-4 text-lg"
        onClick={submit}
        disabled={busy || !reason.trim() || !attendanceId}
      >
        {busy ? '전송 중…' : '수정 요청'}
      </button>
    </div>
  );
}
