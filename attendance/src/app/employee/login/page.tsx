'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** 현장에서 쓰기 쉽도록 숫자 키패드로 PIN을 입력한다. */
export default function EmployeeLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function tapNum(n: string) {
    setError('');
    if (pin.length < 6) setPin(pin + n);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/employee-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || '로그인에 실패했습니다.');
        setPin('');
        return;
      }
      router.push('/employee');
      router.refresh();
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 p-5">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-black text-slate-900">출퇴근 로그인</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          휴대폰번호와 PIN을 입력하세요
        </p>

        <div className="card mt-6">
          <label className="label" htmlFor="phone">휴대폰번호</label>
          <input
            id="phone"
            className="input text-center text-xl font-bold tracking-wider"
            inputMode="numeric"
            placeholder="01012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            required
          />

          <label className="label mt-4">PIN 번호</label>
          <div className="flex h-14 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-3xl font-black tracking-[0.5em]">
            {pin ? '●'.repeat(pin.length) : <span className="text-base tracking-normal text-slate-400">PIN 입력</span>}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {['1','2','3','4','5','6','7','8','9'].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => tapNum(n)}
                className="rounded-xl bg-white py-4 text-2xl font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 active:bg-brand-50"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin('')}
              className="rounded-xl bg-slate-200 py-4 text-base font-bold text-slate-700 active:bg-slate-300"
            >
              전체지움
            </button>
            <button
              type="button"
              onClick={() => tapNum('0')}
              className="rounded-xl bg-white py-4 text-2xl font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 active:bg-brand-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPin(pin.slice(0, -1))}
              className="rounded-xl bg-slate-200 py-4 text-base font-bold text-slate-700 active:bg-slate-300"
            >
              지우기
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-center text-sm font-bold text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !phone || !pin}
          className="btn-primary mt-4 w-full py-5 text-xl"
        >
          {loading ? '확인 중…' : '로그인'}
        </button>
      </form>
    </main>
  );
}
