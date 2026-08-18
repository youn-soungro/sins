/**
 * 검증·시연용 데이터 생성.
 * 실제 운영 데이터가 아니라 화면과 계산을 확인하기 위한 샘플이다.
 *   npx tsx scripts/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { kstToUtc, dateOnly, kstDateStr } from '../src/lib/time';
import { recalcAttendance, syncAutoAllowances } from '../src/lib/attendance-service';

const prisma = new PrismaClient();

const EMPLOYEES = [
  { name: '김철수', phone: '01011112222', job: '간판시공', factory: 250_000, site: 300_000, method: 'DAY_PLUS_OT', meal: 10_000 },
  { name: '박영수', phone: '01033334444', job: '용접',     factory: 230_000, site: 280_000, method: 'DAY_PLUS_OT', meal: 10_000 },
  { name: '이민호', phone: '01055556666', job: '전기',     factory: 260_000, site: 310_000, method: 'FULL_DAY',    meal: 10_000 },
  { name: '정대현', phone: '01077778888', job: '보조',     factory: 180_000, site: 200_000, method: 'HOURLY_PRORATED', meal: 8_000 },
  { name: '최성우', phone: '01099990000', job: '도장',     factory: 240_000, site: 290_000, method: 'DAY_PLUS_OT', meal: 10_000 },
] as const;

async function main() {
  const today = kstDateStr();
  const [y, m] = today.split('-').map(Number);

  // ── 근무지 ────────────────────────────────
  const factory = await prisma.workplace.upsert({
    where: { name: '디자인재성 공장' },
    create: { name: '디자인재성 공장', type: 'FACTORY', address: '경기도 안산시', lat: 37.3000, lng: 126.8400, radiusM: 200 },
    update: { lat: 37.3000, lng: 126.8400, radiusM: 200 },
  });
  const siteWp = await prisma.workplace.upsert({
    where: { name: '안산 중앙동 현장' },
    create: { name: '안산 중앙동 현장', type: 'SITE', address: '안산시 단원구 중앙대로', lat: 37.3219, lng: 126.8309, radiusM: 300 },
    update: {},
  });

  // ── 현장 ──────────────────────────────────
  let project = await prisma.project.findFirst({ where: { name: '안산 중앙동 간판설치' } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: '안산 중앙동 간판설치', clientName: '중앙상가', address: '안산시 단원구',
        manager: '박담당', managerPhone: '01012345678',
        startDate: dateOnly(`${y}-${String(m).padStart(2, '0')}-01`),
        status: 'ONGOING', workplaceId: siteWp.id,
      },
    });
  }

  // ── 직원 ──────────────────────────────────
  const created: { id: string; name: string }[] = [];
  for (const e of EMPLOYEES) {
    let emp = await prisma.employee.findUnique({ where: { phone: e.phone } });
    if (!emp) {
      const count = await prisma.employee.count();
      const user = await prisma.user.create({
        data: {
          loginId: e.phone,
          passwordHash: await bcrypt.hash(e.phone.slice(-4), 10),
          name: e.name, role: 'EMPLOYEE',
        },
      });
      emp = await prisma.employee.create({
        data: {
          empNo: `E${String(count + 1).padStart(4, '0')}`,
          name: e.name, phone: e.phone, jobType: e.job,
          hireDate: dateOnly(`${y - 1}-03-02`), userId: user.id,
        },
      });
      await prisma.employeePayRate.create({
        data: {
          employeeId: emp.id, effectiveFrom: dateOnly(`${y - 1}-03-02`),
          calcMethod: e.method, baseDailyWage: e.factory,
          factoryDailyWage: e.factory, siteDailyWage: e.site,
          mealAllowance: e.meal, memo: '시연용 초기 단가',
        },
      });
    }
    created.push({ id: emp.id, name: emp.name });
  }

  // ── 이번 달 근무기록 (평일만) ────────────────
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const todayDay = Number(today.slice(8, 10));
  let count = 0;

  for (let d = 1; d <= Math.min(lastDay, todayDay); d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (weekday === 0) continue; // 일요일 휴무

    for (let i = 0; i < created.length; i++) {
      const emp = created[i];
      // 직원마다 결근이 조금씩 섞이게 한다.
      if ((d + i) % 7 === 0) continue;

      const isSite = (d + i) % 3 === 0;
      const inMin = 8 * 60 - 5 + ((d * 7 + i * 13) % 25); // 07:55~08:20
      const outMin = 17 * 60 + ((d * 11 + i * 17) % 150); // 17:00~19:30

      // 오늘 기록은 "근무중"으로 남겨야 하므로 출근시각이 미래가 되지 않도록 3시간 전으로 맞춘다.
      const rawIn = kstToUtc(dateStr, `${String(Math.floor(inMin / 60)).padStart(2, '0')}:${String(inMin % 60).padStart(2, '0')}`);
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const checkInAt = d === todayDay && rawIn > threeHoursAgo ? threeHoursAgo : rawIn;
      const checkOutAt = kstToUtc(dateStr, `${String(Math.floor(outMin / 60)).padStart(2, '0')}:${String(outMin % 60).padStart(2, '0')}`);

      const existing = await prisma.attendance.findUnique({
        where: { employeeId_workDate: { employeeId: emp.id, workDate: dateOnly(dateStr) } },
      });
      if (existing) continue;

      const att = await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          workDate: dateOnly(dateStr),
          checkInAt,
          checkOutAt: d === todayDay ? null : checkOutAt, // 오늘은 근무중으로 둔다
          status: d === todayDay ? 'WORKING' : 'DONE',
          workplaceId: isSite ? siteWp.id : factory.id,
          projectId: isSite ? project.id : null,
          workType: isSite ? 'SITE' : 'FACTORY',
          checkInGps: 'OK',
          checkInLat: isSite ? 37.3220 : 37.3001,
          checkInLng: isSite ? 126.8310 : 126.8401,
          checkInDistanceM: 15 + (d % 40),
          isLate: inMin > 8 * 60 + 10,
        },
      });
      // 점심 휴게 1시간
      if (d !== todayDay) {
        await prisma.breakLog.create({
          data: { attendanceId: att.id, startAt: kstToUtc(dateStr, '12:00'), endAt: kstToUtc(dateStr, '13:00'), minutes: 60 },
        });
      }
      await syncAutoAllowances(att.id);
      await recalcAttendance(att.id);
      count++;
    }
  }

  // ── 공제 샘플 ──────────────────────────────
  const first = created[0];
  const dedExists = await prisma.deduction.findFirst({ where: { employeeId: first.id } });
  if (!dedExists) {
    await prisma.deduction.create({
      data: {
        employeeId: first.id, workDate: dateOnly(`${y}-${String(m).padStart(2, '0')}-10`),
        type: 'ADVANCE', amount: 200_000, reason: '가불 (본인 요청)', createdBy: '관리자',
      },
    });
  }

  console.log(`✔ 직원 ${created.length}명, 근무기록 ${count}건 생성 완료`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
