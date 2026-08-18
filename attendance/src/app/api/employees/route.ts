/** 직원 목록 조회 / 신규 등록 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { hashPassword, normalizePhone } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { dateOnly, todayDateOnly } from '@/lib/time';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const q = str(sp.get('q'));
    const status = str(sp.get('status'));

    const employees = await prisma.employee.findMany({
      where: {
        ...(status && status !== 'ALL' ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { phone: { contains: normalizePhone(q) || q } },
                { empNo: { contains: q, mode: 'insensitive' as const } },
                { jobType: { contains: q, mode: 'insensitive' as const } },
                { memo: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { payRates: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
    return ok(employees);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const b = await req.json();

    const name = str(b.name);
    const phone = normalizePhone(str(b.phone) ?? '');
    if (!name) return fail('이름을 입력해 주세요.');
    if (phone.length < 10) return fail('휴대폰번호를 정확히 입력해 주세요.');

    const pin = str(b.pin) ?? phone.slice(-4); // 기본 PIN: 휴대폰 뒷 4자리
    if (pin.length < 4) return fail('PIN은 4자리 이상이어야 합니다.');

    const dupPhone = await prisma.employee.findUnique({ where: { phone } });
    if (dupPhone) return fail('이미 등록된 휴대폰번호입니다.', 409);

    // 직원번호 자동 채번 (미입력 시)
    let empNo = str(b.empNo);
    if (!empNo) {
      const count = await prisma.employee.count();
      empNo = `E${String(count + 1).padStart(4, '0')}`;
      while (await prisma.employee.findUnique({ where: { empNo } })) {
        empNo = `E${String(Number(empNo.slice(1)) + 1).padStart(4, '0')}`;
      }
    }

    const hireDate = str(b.hireDate) ? dateOnly(str(b.hireDate)!) : todayDateOnly();

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          loginId: phone,
          passwordHash: await hashPassword(pin),
          name,
          role: 'EMPLOYEE',
        },
      });
      const emp = await tx.employee.create({
        data: {
          empNo: empNo!,
          name,
          phone,
          hireDate,
          status: (str(b.status) as never) ?? 'ACTIVE',
          jobType: str(b.jobType),
          bankName: str(b.bankName),
          bankAccount: str(b.bankAccount),
          memo: str(b.memo),
          userId: user.id,
        },
      });
      // 최초 단가는 입사일부터 적용
      await tx.employeePayRate.create({
        data: {
          employeeId: emp.id,
          effectiveFrom: hireDate,
          calcMethod: (str(b.calcMethod) as never) ?? 'DAY_PLUS_OT',
          baseDailyWage: num(b.baseDailyWage),
          factoryDailyWage: num(b.factoryDailyWage),
          siteDailyWage: num(b.siteDailyWage),
          overtimeHourlyRate: num(b.overtimeHourlyRate),
          nightHourlyRate: num(b.nightHourlyRate),
          holidayHourlyRate: num(b.holidayHourlyRate),
          mealAllowance: num(b.mealAllowance),
          lodgingAllowance: num(b.lodgingAllowance),
          vehicleAllowance: num(b.vehicleAllowance),
          otherAllowance: num(b.otherAllowance),
          memo: '최초 등록',
        },
      });
      return emp;
    });

    await writeAudit(admin, {
      entity: 'employees',
      entityId: created.id,
      action: 'CREATE',
      after: { empNo: created.empNo, name: created.name, phone: created.phone },
      ip: clientIp(req),
    });

    return ok({ ...created, initialPin: pin });
  } catch (e) {
    return handleError(e);
  }
}
