/**
 * 데이터 백업.
 *   npm run backup
 *
 * pg_dump 이 있으면 SQL 덤프를, 없으면 테이블별 JSON 을 남긴다.
 * 결과는 backups/ 폴더에 저장된다. (정기 백업은 서버 cron 에 등록해서 사용)
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const run = promisify(execFile);
const prisma = new PrismaClient();

async function main() {
  const dir = path.resolve(process.cwd(), 'backups');
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 이 설정되지 않았습니다.');

  // 1) pg_dump 시도
  try {
    const out = path.join(dir, `backup_${stamp}.sql`);
    await run('pg_dump', ['--no-owner', '--no-acl', '-f', out, url]);
    console.log(`✔ SQL 백업 완료: ${out}`);
    return;
  } catch {
    console.log('· pg_dump 를 사용할 수 없어 JSON 백업으로 진행합니다.');
  }

  // 2) JSON 백업
  const data = {
    exportedAt: new Date().toISOString(),
    users: await prisma.user.findMany({ select: { id: true, loginId: true, name: true, role: true, isActive: true } }),
    employees: await prisma.employee.findMany(),
    employeePayRates: await prisma.employeePayRate.findMany(),
    workplaces: await prisma.workplace.findMany(),
    projects: await prisma.project.findMany(),
    attendance: await prisma.attendance.findMany(),
    breaks: await prisma.breakLog.findMany(),
    allowances: await prisma.allowance.findMany(),
    deductions: await prisma.deduction.findMany(),
    payroll: await prisma.payroll.findMany(),
    payments: await prisma.payment.findMany(),
    editRequests: await prisma.attendanceEditRequest.findMany(),
    auditLogs: await prisma.auditLog.findMany({ take: 50_000, orderBy: { createdAt: 'desc' } }),
    settings: await prisma.setting.findMany(),
  };
  const out = path.join(dir, `backup_${stamp}.json`);
  await writeFile(out, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✔ JSON 백업 완료: ${out}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
