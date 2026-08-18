'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PayrollActions({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!confirm(`${year}년 ${month}월 전체 직원 정산을 실행하고 확정하시겠습니까?\n\n확정하면 직원이 자기 휴대폰에서 정산내역을 확인할 수 있습니다.`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, confirm: true }),
      });
      const j = await res.json();
      alert(j.ok ? `${j.data.count}명 정산이 완료되었습니다.` : j.message);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <button className="btn-primary" onClick={run} disabled={busy}>
      {busy ? '정산 중…' : `${month}월 전체 정산 실행`}
    </button>
  );
}
