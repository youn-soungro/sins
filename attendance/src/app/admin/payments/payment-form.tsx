'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PAYMENT_METHOD_LABEL } from '@/lib/labels';
import { utcToKstLocalInput } from '@/lib/time';
import { won } from '@/lib/payroll';

export default function PaymentForm({
  payrollId,
  employeeName,
  remaining,
}: {
  payrollId: string;
  employeeName: string;
  remaining: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(remaining));
  const [paidAt, setPaidAt] = useState(utcToKstLocalInput(new Date()));
  const [method, setMethod] = useState('TRANSFER');
  const [memo, setMemo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollId, amount, paidAt, method, memo }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.message); return; }
      setOpen(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button className="btn-success text-xs" onClick={() => setOpen(true)}>
        지급 처리 (잔액 {won(remaining)}원)
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-sm font-black">{employeeName} 지급 등록</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label !text-xs">지급금액</label>
          <input className="input text-right" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label !text-xs">지급일시</label>
          <input type="datetime-local" className="input" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div>
          <label className="label !text-xs">지급방법</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label !text-xs">메모</label>
          <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>
      {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>취소</button>
        <button className="btn-success text-xs" onClick={save} disabled={busy}>지급 등록</button>
      </div>
    </div>
  );
}
