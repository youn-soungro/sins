'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfirmButton({ payrollId }: { payrollId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function confirm() {
    if (!window.confirm('정산 내역을 확인하셨습니까?\n확인 시각이 기록됩니다.')) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/payroll/employee-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollId }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.message); return; }
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      {err && <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}
      <button onClick={confirm} disabled={busy} className="btn-primary w-full py-4 text-lg">
        {busy ? '처리 중…' : '정산 확인'}
      </button>
    </>
  );
}
