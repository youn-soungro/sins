/**
 * 초기 데이터 생성.
 * - 최초 관리자 계정
 * - 기본 설정값
 * - 디자인재성 공장 근무지
 * 이미 존재하면 건너뛰므로 여러 번 실행해도 안전하다.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── 관리자 계정 ──────────────────────────────
  const loginId = process.env.ADMIN_LOGIN_ID || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin1234';
  const name = process.env.ADMIN_NAME || '관리자';

  const existing = await prisma.user.findUnique({ where: { loginId } });
  if (!existing) {
    await prisma.user.create({
      data: { loginId, passwordHash: await bcrypt.hash(password, 10), name, role: 'ADMIN' },
    });
    console.log(`✔ 관리자 계정 생성: ${loginId} / ${password}`);
  } else {
    console.log(`· 관리자 계정 이미 존재: ${loginId}`);
  }

  // ── 기본 설정 ────────────────────────────────
  const settings: Array<[string, string, string]> = [
    ['company.name', '디자인재성', '회사명'],
    ['work.start', '08:00', '기본 근무 시작'],
    ['work.end', '17:00', '기본 근무 종료'],
    ['work.breakStart', '12:00', '기본 휴게 시작'],
    ['work.breakEnd', '13:00', '기본 휴게 종료'],
    ['work.standardMinutes', '480', '기본 근무시간(분)'],
    ['work.lateThreshold', '08:10', '지각 기준'],
    ['work.nightStart', '22:00', '야간근무 시작'],
    ['work.nightEnd', '06:00', '야간근무 종료'],
    ['work.autoCloseAfterHours', '16', '퇴근 누락 자동마감 기준(시간)'],
  ];
  for (const [key, value, memo] of settings) {
    await prisma.setting.upsert({ where: { key }, create: { key, value, memo }, update: {} });
  }
  console.log('✔ 기본 설정 확인 완료');

  // ── 기본 근무지 ──────────────────────────────
  await prisma.workplace.upsert({
    where: { name: '디자인재성 공장' },
    create: {
      name: '디자인재성 공장',
      type: 'FACTORY',
      address: '경기도 안산시',
      radiusM: 200,
      memo: '본사 공장',
    },
    update: {},
  });
  console.log('✔ 기본 근무지 확인 완료');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
