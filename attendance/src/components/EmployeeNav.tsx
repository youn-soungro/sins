'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { href: '/employee', label: '오늘 근무', icon: '🏠' },
  { href: '/employee/records', label: '내 근무기록', icon: '📅' },
  { href: '/employee/payroll', label: '내 정산내역', icon: '🧾' },
  { href: '/employee/requests', label: '수정요청', icon: '✉️' },
  { href: '/employee/me', label: '내 정보', icon: '👤' },
];

export default function EmployeeNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/employee/login');
    router.refresh();
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => {
          const active = t.href === '/employee' ? pathname === '/employee' : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${
                active ? 'text-brand-600' : 'text-slate-400'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
      <button onClick={logout} className="sr-only">로그아웃</button>
    </nav>
  );
}
