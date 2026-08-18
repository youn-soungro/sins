'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RequestActions({
  requestId,
  employeeName,
}: {
  requestId: string;
  employeeName: string;
}) {
  const router = useRouter();
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function act(action: 'approve' | 'reject') {
    if (action === 'approve' && !confirm(`${employeeName}님의 수정요청을 승인하시겠습니까?\n출퇴근 기록이 실제로 변경되고 금액이 다시 계산됩니다.`)) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/edit-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewMemo: memo }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.message); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div>
      <input
        className="input mb-2"
        placeholder="처리 메모 (선택)"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
      />
      {err && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-success flex-1" onClick={() => act('approve')} disabled={busy}>승인</button>
        <button className="btn-ghost flex-1 text-rose-600" onClick={() => act('reject')} disabled={busy}>반려</button>
      </div>
    </div>
  );
}
