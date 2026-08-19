/**
 * 로그인 화면 전용 레이아웃.
 *
 * /employee/login 은 세션이 없는 상태에서 열려야 하므로,
 * 세션을 요구하는 app/employee/layout.tsx 아래에 두면 자기 자신으로 무한 리다이렉트된다.
 * 라우트 그룹 (auth) 로 분리해 URL 은 그대로 두고 레이아웃만 떼어낸다.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
