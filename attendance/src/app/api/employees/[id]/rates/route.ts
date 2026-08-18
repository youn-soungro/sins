/** 직원 단가 이력 조회 / 신규 단가 등록 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { dateOnly, todayDateOnly } from '@/lib/time';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const rates = await prisma.employeePayRate.findMany({
      where: { employeeId: id },
      orderBy: { effectiveFrom: 'desc' },
    });
    return ok(rates);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json();

    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) return fail('직원을 찾을 수 없습니다.', 404);

    const effectiveFrom = str(b.effectiveFrom) ? dateOnly(str(b.effectiveFrom)!) : todayDateOnly();

    const data = {
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
      memo: str(b.memo),
    };

    // 같은 적용일이 있으면 덮어쓰고, 없으면 새 이력을 만든다.
    const rate = await prisma.employeePayRate.upsert({
      where: { employeeId_effectiveFrom: { employeeId: id, effectiveFrom } },
      create: { employeeId: id, effectiveFrom, ...data },
      update: data,
    });

    await writeAudit(admin, {
      entity: 'employee_pay_rates',
      entityId: rate.id,
      action: 'UPSERT',
      after: { employee: emp.name, effectiveFrom: effectiveFrom.toISOString(), ...data },
      reason: str(b.reason),
      ip: clientIp(req),
    });

    return ok(rate);
  } catch (e) {
    return handleError(e);
  }
}
