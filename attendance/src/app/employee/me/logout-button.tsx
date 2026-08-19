'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/employee/login');
    router.refresh();
  }

  return (
    <button onClick={logout} className="btn-ghost w-full py-4 text-base">
      로그아웃
    </button>
  );
}
