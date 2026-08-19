import type { ReactNode } from 'react';
import { won } from '@/lib/payroll';

export function StatCard({
  label,
  value,
  unit,
  tone = 'default',
  sub,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'rose' | 'slate';
  sub?: string;
}) {
  const tones: Record<string, string> = {
    default: 'bg-white text-slate-900',
    blue: 'bg-brand-50 text-brand-800 ring-brand-100',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-800 ring-amber-100',
    rose: 'bg-rose-50 text-rose-800 ring-rose-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ring-slate-200 ${tones[tone]}`}>
      <div className="text-xs font-bold opacity-70">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-black tabular-nums sm:text-3xl">{value}</span>
        {unit && <span className="text-sm font-bold opacity-70">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs font-semibold opacity-60">{sub}</div>}
    </div>
  );
}

export function MoneyCard({ label, amount, tone = 'blue' }: { label: string; amount: number; tone?: 'blue' | 'green' | 'rose' }) {
  return <StatCard label={label} value={won(amount)} unit="원" tone={tone} />;
}

const BADGE_TONES: Record<string, string> = {
  WORKING: 'bg-emerald-100 text-emerald-800',
  ON_BREAK: 'bg-amber-100 text-amber-800',
  DONE: 'bg-slate-200 text-slate-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  LEAVE_DAY: 'bg-sky-100 text-sky-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  LEAVE: 'bg-amber-100 text-amber-800',
  RESIGNED: 'bg-slate-200 text-slate-600',
  FACTORY: 'bg-indigo-100 text-indigo-700',
  SITE: 'bg-orange-100 text-orange-700',
  ETC: 'bg-slate-200 text-slate-600',
  OK: 'bg-emerald-100 text-emerald-800',
  OUT_OF_RANGE: 'bg-rose-100 text-rose-700',
  NO_GPS: 'bg-slate-200 text-slate-600',
  APPROVED: 'bg-sky-100 text-sky-700',
  PENDING: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-rose-100 text-rose-700',
  DRAFT: 'bg-slate-200 text-slate-600',
  CONFIRMED: 'bg-brand-100 text-brand-800',
  UNPAID: 'bg-rose-100 text-rose-700',
  PARTIAL: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  ONGOING: 'bg-emerald-100 text-emerald-800',
  PLANNED: 'bg-sky-100 text-sky-700',
  HOLD: 'bg-amber-100 text-amber-800',
};

export function Badge({ code, text }: { code: string; text: string }) {
  return <span className={`badge ${BADGE_TONES[code] ?? 'bg-slate-200 text-slate-700'}`}>{text}</span>;
}

export function PageTitle({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm font-semibold text-slate-400">
      {text}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-black text-slate-800">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
