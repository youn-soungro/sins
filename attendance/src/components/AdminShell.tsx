'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const MENU = [
  { href: '/admin', label: '대시보드', icon: '📊' },
  { href: '/admin/today', label: '오늘 출근현황', icon: '🕗' },
  { href: '/admin/attendance', label: '출퇴근 관리', icon: '📋' },
  { href: '/admin/employees', label: '직원관리', icon: '👷' },
  { href: '/admin/workplaces', label: '근무지관리', icon: '🏭' },
  { href: '/admin/projects', label: '현장관리', icon: '🚧' },
  { href: '/admin/allowances', label: '추가수당', icon: '➕' },
  { href: '/admin/deductions', label: '공제관리', icon: '➖' },
  { href: '/admin/payroll', label: '월별정산', icon: '🧾' },
  { href: '/admin/payments', label: '지급관리', icon: '💳' },
  { href: '/admin/project-cost', label: '현장별 인건비', icon: '🏗️' },
  { href: '/admin/requests', label: '수정요청', icon: '✉️' },
  { href: '/admin/audit', label: '수정이력', icon: '🗂️' },
  { href: '/admin/excel', label: '엑셀 다운로드', icon: '📑' },
  { href: '/admin/settings', label: '설정', icon: '⚙️' },
];

export default function AdminShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div className="min-h-dvh bg-slate-100">
      {/* 상단바 (모바일) */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg px-3 py-2 text-lg font-bold text-slate-700 ring-1 ring-slate-200"
          aria-label="메뉴"
        >
          ☰
        </button>
        <span className="font-black text-slate-900">디자인재성 근태관리</span>
        <button onClick={logout} className="text-sm font-bold text-slate-500">
          로그아웃
        </button>
      </header>

      {open && (
        <nav className="no-print border-b border-slate-200 bg-white p-3 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {MENU.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-3 text-sm font-bold ${
                  isActive(m.href) ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <span className="mr-1">{m.icon}</span>
                {m.label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <div className="flex">
        {/* 사이드바 (PC) */}
        <aside className="no-print sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="text-base font-black text-slate-900">디자인재성</div>
            <div className="text-xs font-semibold text-slate-500">근태·일당 관리</div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {MENU.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className={`mb-0.5 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  isActive(m.href)
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{m.icon}</span>
                {m.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="mb-2 truncate px-1 text-xs font-bold text-slate-500">{userName} 님</div>
            <button onClick={logout} className="btn-ghost w-full text-xs">
              로그아웃
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
