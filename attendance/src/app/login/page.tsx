'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || '로그인에 실패했습니다.');
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-6">
      <form onSubmit={submit} className="card w-full max-w-sm">
        <h1 className="text-2xl font-black text-slate-900">관리자 로그인</h1>
        <p className="mt-1 text-sm text-slate-500">디자인재성 근태관리 시스템</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="loginId">아이디</label>
            <input
              id="loginId"
              className="input"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary mt-6 w-full py-3 text-base" disabled={loading}>
          {loading ? '로그인 중…' : '로그인'}
        </button>

        <Link href="/employee/login" className="mt-4 block text-center text-sm font-semibold text-brand-600">
          직원 출퇴근 화면으로 →
        </Link>
      </form>
    </main>
  );
}
