'use client';

import { useState } from 'react';

const REPORTS = [
  { type: 'attendance', title: '전체 출퇴근 기록', desc: '기간 내 모든 직원의 출퇴근 상세', useRange: true },
  { type: 'employee-attendance', title: '직원별 출퇴근 기록', desc: '선택한 직원의 출퇴근 상세', useRange: true, useEmployee: true },
  { type: 'monthly', title: '월별 근무현황', desc: '선택한 월의 전체 근무 내역', useMonth: true },
  { type: 'payroll', title: '직원별 급여정산', desc: '월별 근무일·수당·공제·최종 지급액', useMonth: true },
  { type: 'project-cost', title: '현장별 인건비', desc: '현장 원가계산용 인건비 집계', useRange: true },
  { type: 'allowances', title: '추가수당', desc: '기간 내 등록된 추가수당 내역', useRange: true, useEmployee: true },
  { type: 'deductions', title: '공제내역', desc: '기간 내 공제 내역과 사유', useRange: true, useEmployee: true },
  { type: 'payments', title: '지급내역', desc: '급여 지급 기록 전체', useRange: false },
];

export default function ExcelPanel({
  employees,
  defaultFrom,
  defaultTo,
  year,
  month,
}: {
  employees: { id: string; name: string }[];
  defaultFrom: string;
  defaultTo: string;
  year: number;
  month: number;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [employeeId, setEmployeeId] = useState('ALL');
  const [y, setY] = useState(String(year));
  const [m, setM] = useState(String(month));

  function urlFor(r: (typeof REPORTS)[number]) {
    const q = new URLSearchParams({ type: r.type });
    if (r.useRange) { q.set('from', from); q.set('to', to); }
    if (r.useMonth) { q.set('year', y); q.set('month', m); }
    if (r.useEmployee && employeeId !== 'ALL') q.set('employeeId', employeeId);
    return `/api/excel?${q.toString()}`;
  }

  return (
    <>
      <div className="card mb-5">
        <h2 className="mb-3 text-base font-black">다운로드 조건</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">시작일</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">종료일</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label">직원 (해당 자료만 적용)</label>
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="ALL">전체 직원</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label">정산 연도</label>
              <input className="input" inputMode="numeric" value={y} onChange={(e) => setY(e.target.value)} />
            </div>
            <div className="w-20">
              <label className="label">월</label>
              <input className="input" inputMode="numeric" value={m} onChange={(e) => setM(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <a key={r.type} href={urlFor(r)} className="card block transition hover:shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📑</span>
              <div>
                <div className="font-black text-slate-900">{r.title}</div>
                <div className="mt-0.5 text-sm text-slate-500">{r.desc}</div>
                <div className="mt-2 text-xs font-bold text-brand-600">엑셀 다운로드 →</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
