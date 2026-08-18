import next from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['.next/**', 'node_modules/**', 'backups/**', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    plugins: { '@next/next': next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
      // 라우트 핸들러에서 Prisma 동적 필터를 다룰 때 필요한 캐스팅을 허용한다.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
