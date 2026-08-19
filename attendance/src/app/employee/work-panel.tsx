'use client';

import { useCallback, useEffect, useState } from 'react';
import { minutesToKorean } from '@/lib/time';
import { won } from '@/lib/payroll';
import { WORKPLACE_TYPE_LABEL } from '@/lib/labels';

interface Workplace { id: string; name: string; type: 'FACTORY' | 'SITE' | 'ETC'; radiusM: number }
interface Project { id: string; name: string; address: string | null; workplaceId: string | null }

interface Today {
  state: 'NOT_CHECKED_IN' | 'WORKING' | 'ON_BREAK' | 'DONE';
  today: string;
  attendance: null | {
    id: string;
    workDate: string;
    checkIn: string;
    checkOut: string | null;
    workplaceName: string | null;
    projectName: string | null;
    isLate: boolean;
    breaks: Array<{ id: string; start: string; end: string | null; minutes: number }>;
    live: {
      totalMinutes: number; breakMinutes: number; actualMinutes: number;
      normalMinutes: number; overtimeMinutes: number; nightMinutes: number;
    };
    pay: { basePay: number; overtimePay: number; allowanceTotal: number; dayTotalPay: number };
  };
}

/** 위치정보를 가져온다. 거부/실패해도 출근은 가능하도록 null 을 돌려준다. */
function getPosition(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }
    const timer = setTimeout(() => resolve({ lat: null, lng: null }), 8000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve({ lat: null, lng: null });
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 },
    );
  });
}

export default function WorkPanel({
  employeeName,
  workplaces,
  projects,
}: {
  employeeName: string;
  workplaces: Workplace[];
  projects: Project[];
}) {
  const [today, setToday] = useState<Today | null>(null);
  const [workplaceId, setWorkplaceId] = useState(workplaces[0]?.id ?? '');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [clock, setClock] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/attendance/today', { cache: 'no-store' });
    const json = await res.json();
    if (json.ok) setToday(json.data);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // 1분마다 근무시간 갱신
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date()),
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const selectedWorkplace = workplaces.find((w) => w.id === workplaceId);
  const isSite = selectedWorkplace?.type === 'SITE';

  async function post(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function checkIn(force = false) {
    setBusy(true);
    setMsg('');
    try {
      const pos = await getPosition();
      const json = await post('/api/attendance/check-in', {
        workplaceId,
        projectId: isSite ? projectId || null : null,
        workType: selectedWorkplace?.type ?? 'FACTORY',
        ...pos,
        forceOutOfRange: force,
      });
      if (!json.ok) {
        if (json.code === 'OUT_OF_RANGE') {
          const goAhead = confirm(
            `지정된 근무지에서 멀리 떨어져 있습니다.\n\n` +
              `근무지: ${json.workplaceName}\n` +
              `허용반경: ${json.radiusM}m\n` +
              `현재거리: ${json.distanceM}m\n\n` +
              `그래도 출근하시겠습니까?\n(관리자 확인 대상으로 기록됩니다)`,
          );
          if (goAhead) return checkIn(true);
          return;
        }
        setMsg(json.message);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    if (!confirm('퇴근 처리하시겠습니까?')) return;
    setBusy(true);
    setMsg('');
    try {
      const pos = await getPosition();
      const json = await post('/api/attendance/check-out', pos);
      if (!json.ok) {
        setMsg(json.message);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleBreak(action: 'start' | 'end') {
    setBusy(true);
    setMsg('');
    try {
      const json = await post('/api/attendance/break', { action });
      if (!json.ok) setMsg(json.message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!today) {
    return <div className="py-20 text-center text-slate-400">불러오는 중…</div>;
  }

  const a = today.attendance;

  return (
    <div className="space-y-4">
      {/* 현재 시각 */}
      <div className="rounded-2xl bg-brand-700 px-4 py-5 text-center text-white">
        <div className="text-sm font-bold text-brand-100">{today.today}</div>
        <div className="mt-1 text-4xl font-black tabular-nums">{clock}</div>
        <div className="mt-1 text-sm font-semibold text-brand-100">{employeeName} 님</div>
      </div>

      {msg && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-700">{msg}</p>
      )}

      {/* ── 출근 전 ─────────────────────────── */}
      {today.state === 'NOT_CHECKED_IN' && (
        <>
          <div className="card">
            <label className="label">오늘 근무지</label>
            <select
              className="input text-lg font-bold"
              value={workplaceId}
              onChange={(e) => {
                setWorkplaceId(e.target.value);
                setProjectId('');
              }}
            >
              {workplaces.map((w) => (
                <option key={w.id} value={w.id}>
                  [{WORKPLACE_TYPE_LABEL[w.type]}] {w.name}
                </option>
              ))}
            </select>

            {isSite && (
              <>
                <label className="label mt-4">현장 선택</label>
                <select
                  className="input text-lg font-bold"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">현장을 선택하세요</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          <button
            onClick={() => checkIn(false)}
            disabled={busy || !workplaceId}
            className="btn-huge bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {busy ? '처리 중…' : '출근하기'}
          </button>
        </>
      )}

      {/* ── 근무중 / 휴게중 ──────────────────── */}
      {a && (today.state === 'WORKING' || today.state === 'ON_BREAK') && (
        <>
          <div className="card">
            <div className="flex items-center justify-between">
              <span className="text-lg font-black">
                {today.state === 'ON_BREAK' ? '☕ 휴게중' : '🔨 근무중'}
              </span>
              {a.isLate && <span className="badge bg-amber-100 text-amber-800">지각</span>}
            </div>
            <dl className="mt-3 space-y-2 text-base">
              <Row label="출근" value={a.checkIn} />
              <Row label="근무지" value={a.projectName ?? a.workplaceName ?? '미지정'} />
              <Row label="현재 근무시간" value={minutesToKorean(a.live.actualMinutes)} strong />
              {a.live.breakMinutes > 0 && (
                <Row label="휴게시간" value={minutesToKorean(a.live.breakMinutes)} />
              )}
              {a.live.overtimeMinutes > 0 && (
                <Row label="연장근무" value={minutesToKorean(a.live.overtimeMinutes)} />
              )}
            </dl>

            {a.breaks.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {a.breaks.map((b) => (
                  <div key={b.id} className="flex justify-between py-0.5">
                    <span>{b.start} 휴게 시작</span>
                    <span>{b.end ? `${b.end} 종료 (${b.minutes}분)` : '진행중'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {today.state === 'WORKING' ? (
            <button
              onClick={() => toggleBreak('start')}
              disabled={busy}
              className="btn-huge bg-amber-500 py-7 text-2xl text-white hover:bg-amber-600"
            >
              휴게 시작
            </button>
          ) : (
            <button
              onClick={() => toggleBreak('end')}
              disabled={busy}
              className="btn-huge bg-emerald-600 py-7 text-2xl text-white hover:bg-emerald-700"
            >
              휴게 종료
            </button>
          )}

          <button
            onClick={checkOut}
            disabled={busy}
            className="btn-huge bg-rose-600 text-white hover:bg-rose-700"
          >
            {busy ? '처리 중…' : '퇴근하기'}
          </button>
        </>
      )}

      {/* ── 퇴근 완료 ───────────────────────── */}
      {a && today.state === 'DONE' && (
        <div className="card border-2 border-emerald-200 bg-emerald-50">
          <h2 className="text-center text-2xl font-black text-emerald-800">오늘 근무 완료</h2>
          <dl className="mt-4 space-y-2 text-base">
            <Row label="출근" value={a.checkIn} />
            <Row label="퇴근" value={a.checkOut ?? '-'} />
            <Row label="총 체류시간" value={minutesToKorean(a.live.totalMinutes)} />
            <Row label="휴게시간" value={minutesToKorean(a.live.breakMinutes)} />
            <Row label="실근무" value={minutesToKorean(a.live.actualMinutes)} strong />
            <Row label="기본근무" value={minutesToKorean(a.live.normalMinutes)} />
            <Row label="연장근무" value={minutesToKorean(a.live.overtimeMinutes)} />
          </dl>
          <div className="mt-4 rounded-xl bg-white px-4 py-4 text-center">
            <div className="text-sm font-bold text-slate-500">오늘 지급예정</div>
            <div className="mt-1 text-3xl font-black text-emerald-700">
              {won(a.pay.dayTotalPay)}원
            </div>
            <div className="mt-2 text-xs text-slate-500">
              기본 {won(a.pay.basePay)}원 · 연장 {won(a.pay.overtimePay)}원 · 수당{' '}
              {won(a.pay.allowanceTotal)}원
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? 'text-lg font-black text-slate-900' : 'font-bold text-slate-800'}>
        {value}
      </dd>
    </div>
  );
}
