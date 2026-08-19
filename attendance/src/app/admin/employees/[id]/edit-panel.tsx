'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CALC_METHOD_LABEL, EMPLOYEE_STATUS_LABEL } from '@/lib/labels';

interface Employee {
  id: string; empNo: string; name: string; phone: string;
  jobType: string | null; hireDate: string; resignDate: string; status: string;
  bankName: string | null; bankAccount: string | null; memo: string | null;
}
interface Rate {
  calcMethod: string;
  baseDailyWage: number; factoryDailyWage: number; siteDailyWage: number;
  overtimeHourlyRate: number; nightHourlyRate: number; holidayHourlyRate: number;
  mealAllowance: number; lodgingAllowance: number; vehicleAllowance: number; otherAllowance: number;
}

export default function EmployeeEditPanel({
  employee,
  currentRate,
  year,
  month,
}: {
  employee: Employee;
  currentRate: Rate | null;
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'' | 'info' | 'rate' | 'payroll'>('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // 직원정보
  const [info, setInfo] = useState({
    name: employee.name, phone: employee.phone, jobType: employee.jobType ?? '',
    hireDate: employee.hireDate, resignDate: employee.resignDate, status: employee.status,
    bankName: employee.bankName ?? '', bankAccount: employee.bankAccount ?? '',
    memo: employee.memo ?? '', pin: '',
  });

  // 단가
  const [rate, setRate] = useState({
    effectiveFrom: new Date().toISOString().slice(0, 10),
    calcMethod: currentRate?.calcMethod ?? 'DAY_PLUS_OT',
    baseDailyWage: String(currentRate?.baseDailyWage ?? 0),
    factoryDailyWage: String(currentRate?.factoryDailyWage ?? 0),
    siteDailyWage: String(currentRate?.siteDailyWage ?? 0),
    overtimeHourlyRate: String(currentRate?.overtimeHourlyRate ?? 0),
    nightHourlyRate: String(currentRate?.nightHourlyRate ?? 0),
    holidayHourlyRate: String(currentRate?.holidayHourlyRate ?? 0),
    mealAllowance: String(currentRate?.mealAllowance ?? 0),
    lodgingAllowance: String(currentRate?.lodgingAllowance ?? 0),
    vehicleAllowance: String(currentRate?.vehicleAllowance ?? 0),
    otherAllowance: String(currentRate?.otherAllowance ?? 0),
    memo: '',
  });

  async function saveInfo() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...info, reason: '관리자 직원정보 수정' }),
      });
      const j = await res.json();
      setMsg(j.ok ? '저장되었습니다.' : j.message);
      if (j.ok) { setTab(''); router.refresh(); }
    } finally { setBusy(false); }
  }

  async function saveRate() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/employees/${employee.id}/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rate),
      });
      const j = await res.json();
      setMsg(j.ok ? '단가가 저장되었습니다. 적용일 이후 근무부터 반영됩니다.' : j.message);
      if (j.ok) { setTab(''); router.refresh(); }
    } finally { setBusy(false); }
  }

  async function runPayroll() {
    if (!confirm(`${year}년 ${month}월 정산을 실행하고 확정하시겠습니까?`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employee.id, year, month, confirm: true }),
      });
      const j = await res.json();
      setMsg(j.ok ? '정산이 완료되었습니다. 직원이 휴대폰에서 확인할 수 있습니다.' : j.message);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function resign() {
    const date = prompt('퇴사일을 입력하세요 (YYYY-MM-DD)', new Date().toISOString().slice(0, 10));
    if (!date) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/employees/${employee.id}?resignDate=${date}`, { method: 'DELETE' });
      const j = await res.json();
      setMsg(j.ok ? '퇴사 처리되었습니다. 근무·급여 기록은 그대로 보존됩니다.' : j.message);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost text-xs" onClick={() => setTab(tab === 'info' ? '' : 'info')}>직원정보 수정</button>
        <button className="btn-ghost text-xs" onClick={() => setTab(tab === 'rate' ? '' : 'rate')}>단가 변경</button>
        <button className="btn-primary text-xs" onClick={runPayroll} disabled={busy}>{month}월 정산 실행</button>
        {employee.status !== 'RESIGNED' && (
          <button className="btn-ghost text-xs text-rose-600" onClick={resign} disabled={busy}>퇴사처리</button>
        )}
      </div>

      {msg && <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{msg}</p>}

      {tab === 'info' && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <F label="이름"><input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></F>
          <F label="휴대폰번호"><input className="input" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></F>
          <F label="직종"><input className="input" value={info.jobType} onChange={(e) => setInfo({ ...info, jobType: e.target.value })} /></F>
          <F label="입사일"><input type="date" className="input" value={info.hireDate} onChange={(e) => setInfo({ ...info, hireDate: e.target.value })} /></F>
          <F label="퇴사일"><input type="date" className="input" value={info.resignDate} onChange={(e) => setInfo({ ...info, resignDate: e.target.value })} /></F>
          <F label="재직상태">
            <select className="input" value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value })}>
              {Object.entries(EMPLOYEE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
          <F label="은행"><input className="input" value={info.bankName} onChange={(e) => setInfo({ ...info, bankName: e.target.value })} /></F>
          <F label="계좌번호"><input className="input" value={info.bankAccount} onChange={(e) => setInfo({ ...info, bankAccount: e.target.value })} /></F>
          <F label="PIN 재설정 (비우면 유지)"><input className="input" value={info.pin} onChange={(e) => setInfo({ ...info, pin: e.target.value })} /></F>
          <F label="메모"><textarea className="input" rows={2} value={info.memo} onChange={(e) => setInfo({ ...info, memo: e.target.value })} /></F>
          <button className="btn-primary w-full" onClick={saveInfo} disabled={busy}>저장</button>
        </div>
      )}

      {tab === 'rate' && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            단가를 바꿔도 <b>이미 지난 근무의 금액은 변하지 않습니다.</b> 적용 시작일 이후 근무부터 반영됩니다.
          </p>
          <F label="적용 시작일"><input type="date" className="input" value={rate.effectiveFrom} onChange={(e) => setRate({ ...rate, effectiveFrom: e.target.value })} /></F>
          <F label="계산방식">
            <select className="input" value={rate.calcMethod} onChange={(e) => setRate({ ...rate, calcMethod: e.target.value })}>
              {Object.entries(CALC_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </F>
          {([
            ['baseDailyWage', '기본 일당'], ['factoryDailyWage', '공장 일당'], ['siteDailyWage', '현장 일당'],
            ['overtimeHourlyRate', '연장 시간당 (0=자동)'], ['nightHourlyRate', '야간 시간당'], ['holidayHourlyRate', '휴일 시간당'],
            ['mealAllowance', '식대(일)'], ['lodgingAllowance', '숙박비(일)'], ['vehicleAllowance', '차량비(일)'], ['otherAllowance', '기타수당(일)'],
          ] as const).map(([k, label]) => (
            <F key={k} label={label}>
              <input
                className="input text-right"
                inputMode="numeric"
                value={rate[k]}
                onChange={(e) => setRate({ ...rate, [k]: e.target.value })}
              />
            </F>
          ))}
          <button className="btn-primary w-full" onClick={saveRate} disabled={busy}>단가 저장</button>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label !mb-0.5 !text-xs">{label}</label>
      {children}
    </div>
  );
}
