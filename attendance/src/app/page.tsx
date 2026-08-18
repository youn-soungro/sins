import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.role === 'ADMIN' ? '/admin' : '/employee');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-gradient-to-b from-brand-700 to-brand-900 p-6">
      <div className="text-center text-white">
        <h1 className="text-3xl font-black sm:text-4xl">디자인재성</h1>
        <p className="mt-2 text-lg font-semibold text-brand-100">직원 출퇴근 · 일당 관리</p>
      </div>

      <div className="grid w-full max-w-md gap-4">
        <Link
          href="/employee/login"
          className="btn-huge bg-white text-brand-700 hover:bg-brand-50"
        >
          직원 출퇴근
        </Link>
        <Link
          href="/login"
          className="btn-huge border-2 border-white/40 bg-transparent py-6 text-xl text-white hover:bg-white/10"
        >
          관리자 로그인
        </Link>
      </div>
    </main>
  );
}
