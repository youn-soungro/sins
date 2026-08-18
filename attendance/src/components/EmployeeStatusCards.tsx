'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from './ui';
import { WORKPLACE_TYPE_LABEL } from '@/lib/labels';
import { won } from '@/lib/payroll';
import { kstTimeStr, minutesToKorean } from '@/lib/time';

export interface StatusCard {
  employeeId: string;
  name: string;
  jobType: string | null;
  state: 'NOT_CHECKED_IN' | 'WORKING' | 'ON_BREAK' | 'DONE';
  checkIn: string | null;
  checkOut: string | null;
  workplaceName: string | null;
  workType: string | null;
  liveMinutes: number;
  overtimeMinutes: number;
  isLate: boolean;
  dayTotalPay: number;
  liveLabel: string;
}

const STATE_LABEL: Record<StatusCard['state'], string> = {
  NOT_CHECKED_IN: '미출근',
  WORKING: '근무중',
  ON_BREAK: '휴게중',
  DONE: '퇴근완료',
};

export default function EmployeeStatusCards({ cards }: { cards: StatusCard[] }) {
  // 근무중인 직원의 경과시간을 1분마다 갱신한다.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => {
        const live =
          c.state === 'WORKING' || c.state === 'ON_BREAK'
            ? c.liveMinutes + tick // 분 단위 근사 증가
            : c.liveMinutes;
        return (
          <Link
            key={c.employeeId}
            href={`/admin/employees/${c.employeeId}`}
            className={`card block transition hover:shadow-md ${
              c.state === 'NOT_CHECKED_IN' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-black text-slate-900">{c.name}</span>
              <div className="flex gap-1">
                {c.isLate && <span className="badge bg-amber-100 text-amber-800">지각</span>}
                <Badge
                  code={
                    c.state === 'NOT_CHECKED_IN'
                      ? 'ABSENT'
                      : c.state === 'ON_BREAK'
                        ? 'ON_BREAK'
                        : c.state === 'DONE'
                          ? 'DONE'
                          : 'WORKING'
                  }
                  text={STATE_LABEL[c.state]}
                />
              </div>
            </div>

            {c.state === 'NOT_CHECKED_IN' ? (
              <p className="mt-3 text-sm text-slate-400">
                {c.jobType ?? '직종 미지정'} · 아직 출근하지 않았습니다.
              </p>
            ) : (
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="출근" value={c.checkIn ? kstTimeStr(new Date(c.checkIn)) : '-'} />
                {c.checkOut && <Row label="퇴근" value={kstTimeStr(new Date(c.checkOut))} />}
                <Row
                  label="근무지"
                  value={`${c.workType ? `[${WORKPLACE_TYPE_LABEL[c.workType as 'FACTORY']}] ` : ''}${
                    c.workplaceName ?? '미지정'
                  }`}
                />
                <Row
                  label={c.state === 'DONE' ? '실근무' : '현재 근무시간'}
                  value={minutesToKorean(live)}
                  strong
                />
                {c.overtimeMinutes > 0 && (
                  <Row label="연장근무" value={minutesToKorean(c.overtimeMinutes)} />
                )}
                <Row label="지급예정" value={`${won(c.dayTotalPay)}원`} />
              </dl>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={strong ? 'font-black text-slate-900' : 'font-semibold text-slate-700'}>{value}</dd>
    </div>
  );
}
