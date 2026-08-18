'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkSettings } from '@/lib/payroll';

export default function SettingsForm({
  settings,
  companyName,
}: {
  settings: WorkSettings;
  companyName: string;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    companyName,
    workStart: settings.workStart,
    workEnd: settings.workEnd,
    breakStart: settings.breakStart,
    breakEnd: settings.breakEnd,
    standardMinutes: String(settings.standardMinutes),
    lateThreshold: settings.lateThreshold,
    nightStart: settings.nightStart,
    nightEnd: settings.nightEnd,
    autoCloseAfterHours: String(settings.autoCloseAfterHours),
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const j = await res.json();
      setMsg(j.ok ? '설정이 저장되었습니다.' : j.message);
      if (j.ok) router.refresh();
    } finally { setBusy(false); }
  }

  async function autoClose() {
    if (!confirm('퇴근 기록이 없는 오래된 출근건을 자동 마감합니다.\n계속하시겠습니까?')) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/maintenance/auto-close', { method: 'POST' });
      const j = await res.json();
      setMsg(j.ok ? `${j.data.count}건을 자동 마감했습니다.` : j.message);
      router.refresh();
    } finally { setBusy(false); }
  }

  async function recalc() {
    if (!confirm('바뀐 설정으로 최근 3개월 출퇴근 기록의 근무시간·금액을 다시 계산합니다.\n계속하시겠습니까?')) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/settings/recalc', { method: 'POST' });
      const j = await res.json();
      setMsg(j.ok ? `${j.data.count}건의 기록을 다시 계산했습니다.` : j.message);
      router.refresh();
    } finally { setBusy(false); }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card">
        <h2 className="mb-3 text-base font-black">회사 정보</h2>
        <label className="label">회사명</label>
        <input className="input" value={f.companyName} onChange={set('companyName')} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-base font-black">기본 근무시간</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="근무 시작"><input type="time" className="input" value={f.workStart} onChange={set('workStart')} /></F>
          <F label="근무 종료"><input type="time" className="input" value={f.workEnd} onChange={set('workEnd')} /></F>
          <F label="휴게 시작"><input type="time" className="input" value={f.breakStart} onChange={set('breakStart')} /></F>
          <F label="휴게 종료"><input type="time" className="input" value={f.breakEnd} onChange={set('breakEnd')} /></F>
          <F label="기본 근무시간 (분)">
            <input className="input text-right" inputMode="numeric" value={f.standardMinutes} onChange={set('standardMinutes')} />
          </F>
          <F label="지각 기준 시각"><input type="time" className="input" value={f.lateThreshold} onChange={set('lateThreshold')} /></F>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          연장근무 = 실근무시간 − 기본 근무시간 (음수는 0). 기본 480분 = 8시간.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-base font-black">야간근무 · 퇴근 누락</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="야간근무 시작"><input type="time" className="input" value={f.nightStart} onChange={set('nightStart')} /></F>
          <F label="야간근무 종료"><input type="time" className="input" value={f.nightEnd} onChange={set('nightEnd')} /></F>
          <F label="퇴근 누락 자동마감 (시간)">
            <input className="input text-right" inputMode="numeric" value={f.autoCloseAfterHours} onChange={set('autoCloseAfterHours')} />
          </F>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          출근 후 이 시간이 지나도 퇴근 기록이 없으면 자동으로 마감하고 관리자 확인 대상으로 표시합니다.
        </p>
      </div>

      {msg && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={save} disabled={busy}>설정 저장</button>
        <button className="btn-ghost" onClick={recalc} disabled={busy}>최근 3개월 재계산</button>
        <button className="btn-ghost" onClick={autoClose} disabled={busy}>퇴근 누락 자동마감 실행</button>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
