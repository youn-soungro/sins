import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import EmployeeNav from '@/components/EmployeeNav';

export const dynamic = 'force-dynamic';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/employee/login');

  return (
    <div className="min-h-dvh bg-slate-100 pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="font-black text-slate-900">디자인재성</span>
        <span className="text-sm font-bold text-slate-600">{session.name} 님</span>
      </header>
      <main className="mx-auto max-w-lg p-4">{children}</main>
      <EmployeeNav />
    </div>
  );
}
