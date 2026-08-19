'use client';

import { useState } from 'react';
import { won } from '@/lib/payroll';
import { minutesToKorean, WEEKDAY_KO } from '@/lib/time';
import { WORKPLACE_TYPE_LABEL } from '@/lib/labels';

export interface CalendarDay {
  date: string; // 'YYYY-MM-DD'
  workType: 'FACTORY' | 'SITE' | 'ETC';
  status: string;
  checkIn: string;
  checkOut: string;
  actualMinutes: number;
  overtimeMinutes: number;
  dayTotalPay: number;
  placeName: string | null;
}

const TYPE_COLOR: Record<string, string> = {
  FACTORY: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  SITE: 'bg-orange-100 text-orange-800 border-orange-200',
  ETC: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function WorkCalendar({
  year,
  month,
  days,
}: {
  year: number;
  month: number;
  days: CalendarDay[];
}) {
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const byDate = new Map(days.map((d) => [d.date, d]));

  // 달력 격자 구성 (일요일 시작)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<number | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: lastDay }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_KO.map((w, i) => (
            <div
              key={w}
              className={`py-1.5 text-xs font-black ${
                i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'
              }`}
            >
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const rec = byDate.get(key);
            return (
              <button
                key={key}
                onClick={() => rec && setSelected(rec)}
                disabled={!rec}
                className={`min-h-[64px] rounded-lg border p-1 text-left transition sm:min-h-[76px] ${
                  rec
                    ? `${TYPE_COLOR[rec.workType]} hover:brightness-95`
                    : 'border-slate-100 bg-slate-50/50'
                }`}
              >
                <div className={`text-xs font-bold ${i % 7 === 0 ? 'text-rose-500' : ''}`}>{d}</div>
                {rec && (
                  <>
                    <div className="mt-0.5 text-[10px] font-bold leading-tight">
                      {WORKPLACE_TYPE_LABEL[rec.workType]}
                    </div>
                    <div className="text-[10px] leading-tight opacity-80">
                      {rec.checkIn}~{rec.checkOut}
                    </div>
                    {rec.overtimeMinutes > 0 && (
                      <div className="text-[10px] font-bold leading-tight text-rose-600">연장</div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <Legend color="bg-indigo-100 border-indigo-200" label="공장" />
          <Legend color="bg-orange-100 border-orange-200" label="현장" />
          <Legend color="bg-slate-100 border-slate-200" label="기타" />
          <Legend color="bg-slate-50 border-slate-100" label="결근/휴무" />
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black">{selected.date}</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="근무 구분" value={WORKPLACE_TYPE_LABEL[selected.workType]} />
              <Row label="근무지" value={selected.placeName ?? '-'} />
              <Row label="출근" value={selected.checkIn} />
              <Row label="퇴근" value={selected.checkOut} />
              <Row label="실근무" value={minutesToKorean(selected.actualMinutes)} />
              <Row label="연장근무" value={minutesToKorean(selected.overtimeMinutes)} />
              <Row label="지급예정" value={`${won(selected.dayTotalPay)}원`} />
            </dl>
            <button className="btn-ghost mt-4 w-full" onClick={() => setSelected(null)}>닫기</button>
          </div>
        </div>
      )}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded border ${color}`} />
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-800">{value}</dd>
    </div>
  );
}
