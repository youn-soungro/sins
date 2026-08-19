'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CALC_METHOD_LABEL } from '@/lib/labels';

const EMPTY = {
  name: '', phone: '', empNo: '', jobType: '', hireDate: '', pin: '',
  bankName: '', bankAccount: '', memo: '',
  calcMethod: 'DAY_PLUS_OT',
  baseDailyWage: '', factoryDailyWage: '', siteDailyWage: '',
  overtimeHourlyRate: '', nightHourlyRate: '', holidayHourlyRate: '',
  mealAllowance: '', lodgingAllowance: '', vehicleAllowance: '', otherAllowance: '',
};

export default function EmployeeCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...EMPTY });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    setErr('');
    setSaving(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.message);
        return;
      }
      alert(`직원이 등록되었습니다.\n\n이름: ${json.data.name}\n직원번호: ${json.data.empNo}\n초기 PIN: ${json.data.initialPin}\n\n직원에게 휴대폰번호와 PIN을 알려주세요.`);
      setOpen(false);
      setF({ ...EMPTY });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + 직원 등록
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black">직원 등록</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="이름 *"><input className="input" value={f.name} onChange={set('name')} /></Field>
          <Field label="휴대폰번호 * (로그인 아이디)">
            <input className="input" inputMode="numeric" placeholder="01012345678" value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="직원번호 (비우면 자동)"><input className="input" value={f.empNo} onChange={set('empNo')} /></Field>
          <Field label="PIN (비우면 번호 뒤 4자리)"><input className="input" inputMode="numeric" value={f.pin} onChange={set('pin')} /></Field>
          <Field label="직종"><input className="input" placeholder="간판시공 / 용접 등" value={f.jobType} onChange={set('jobType')} /></Field>
          <Field label="입사일"><input type="date" className="input" value={f.hireDate} onChange={set('hireDate')} /></Field>
        </div>

        <h3 className="mt-6 border-t border-slate-100 pt-4 text-sm font-black text-slate-700">일당 · 단가</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="계산방식">
            <select className="input" value={f.calcMethod} onChange={set('calcMethod')}>
              {Object.entries(CALC_METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="기본 일당"><Won value={f.baseDailyWage} onChange={set('baseDailyWage')} /></Field>
          <Field label="공장 일당"><Won value={f.factoryDailyWage} onChange={set('factoryDailyWage')} /></Field>
          <Field label="현장 일당"><Won value={f.siteDailyWage} onChange={set('siteDailyWage')} /></Field>
          <Field label="연장 시간당 단가 (0이면 일당÷8시간 자동)">
            <Won value={f.overtimeHourlyRate} onChange={set('overtimeHourlyRate')} />
          </Field>
          <Field label="야간 시간당 단가"><Won value={f.nightHourlyRate} onChange={set('nightHourlyRate')} /></Field>
          <Field label="휴일 시간당 단가"><Won value={f.holidayHourlyRate} onChange={set('holidayHourlyRate')} /></Field>
          <Field label="식대 (1일)"><Won value={f.mealAllowance} onChange={set('mealAllowance')} /></Field>
          <Field label="숙박비 (1일)"><Won value={f.lodgingAllowance} onChange={set('lodgingAllowance')} /></Field>
          <Field label="차량비 (1일)"><Won value={f.vehicleAllowance} onChange={set('vehicleAllowance')} /></Field>
          <Field label="기타 고정수당 (1일)"><Won value={f.otherAllowance} onChange={set('otherAllowance')} /></Field>
        </div>

        <h3 className="mt-6 border-t border-slate-100 pt-4 text-sm font-black text-slate-700">기타</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="은행"><input className="input" value={f.bankName} onChange={set('bankName')} /></Field>
          <Field label="계좌번호"><input className="input" value={f.bankAccount} onChange={set('bankAccount')} /></Field>
        </div>
        <Field label="메모"><textarea className="input" rows={2} value={f.memo} onChange={set('memo')} /></Field>

        {err && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setOpen(false)}>취소</button>
          <button className="btn-primary" onClick={save} disabled={saving || !f.name || !f.phone}>
            {saving ? '저장 중…' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Won({ value, onChange }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="relative">
      <input className="input pr-8 text-right" inputMode="numeric" value={value} onChange={onChange} placeholder="0" />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">원</span>
    </div>
  );
}
