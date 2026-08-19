'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALLOWANCE_TYPE_LABEL, DEDUCTION_TYPE_LABEL } from '@/lib/labels';

/** 추가수당 / 공제 등록 공용 폼 */
export default function EntryManager({
  kind,
  employees,
  projects,
}: {
  kind: 'allowance' | 'deduction';
  employees: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const isAllowance = kind === 'allowance';
  const TYPES = isAllowance ? ALLOWANCE_TYPE_LABEL : DEDUCTION_TYPE_LABEL;

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    employeeId: employees[0]?.id ?? '',
    workDate: new Date().toISOString().slice(0, 10),
    type: Object.keys(TYPES)[0],
    amount: '',
    memo: '',
    reason: '',
    projectId: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr('');
    try {
      const res = await fetch(isAllowance ? '/api/allowances' : '/api/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.message); return; }
      setOpen(false);
      setF({ ...f, amount: '', memo: '', reason: '' });
      router.refresh();
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + {isAllowance ? '수당 등록' : '공제 등록'}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5">
        <h3 className="text-lg font-black">{isAllowance ? '추가수당 등록' : '공제 등록'}</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">직원 *</label>
            <select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">날짜</label>
            <input type="date" className="input" value={f.workDate} onChange={(e) => setF({ ...f, workDate: e.target.value })} />
          </div>
          <div>
            <label className="label">종류</label>
            <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">금액 *</label>
            <input className="input text-right" inputMode="numeric" value={f.amount}
              onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" />
          </div>
          {isAllowance && projects.length > 0 && (
            <div>
              <label className="label">현장 (선택)</label>
              <select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
                <option value="">현장 미지정</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">{isAllowance ? '메모' : '공제사유 * (필수)'}</label>
            <textarea
              className="input"
              rows={2}
              value={isAllowance ? f.memo : f.reason}
              onChange={(e) => setF(isAllowance ? { ...f, memo: e.target.value } : { ...f, reason: e.target.value })}
            />
          </div>
        </div>
        {err && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>취소</button>
          <button className="btn-primary" onClick={save} disabled={busy}>등록</button>
        </div>
      </div>
    </div>
  );
}
