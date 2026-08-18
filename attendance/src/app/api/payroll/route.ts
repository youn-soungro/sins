/** 월별 정산 조회 / 계산 실행 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { computePayroll, upsertPayroll } from '@/lib/payroll-service';
import { kstParts } from '@/lib/time';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const nowP = kstParts(new Date());
    const year = num(sp.get('year'), nowP.year);
    const month = num(sp.get('month'), nowP.month);
    const employeeId = str(sp.get('employeeId'));

    // 저장된 정산이 없어도 계산 결과를 보여준다. (미리보기)
    if (employeeId && employeeId !== 'ALL') {
      const [summary, saved] = await Promise.all([
        computePayroll(employeeId, year, month),
        prisma.payroll.findUnique({
          where: { employeeId_year_month: { employeeId, year, month } },
          include: { payments: { orderBy: { paidAt: 'desc' } } },
        }),
      ]);
      return ok({ summary, saved });
    }

    const employees = await prisma.employee.findMany({
      where: { status: { in: ['ACTIVE', 'LEAVE'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, empNo: true },
    });
    const summaries = await Promise.all(
      employees.map((e) => computePayroll(e.id, year, month)),
    );
    const saved = await prisma.payroll.findMany({
      where: { year, month },
      include: { payments: true },
    });
    const savedMap = new Map(saved.map((s) => [s.employeeId, s]));

    return ok({
      year,
      month,
      rows: summaries.map((s) => ({ ...s, saved: savedMap.get(s.employeeId) ?? null })),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** 정산 저장(확정). employeeId 를 생략하면 재직 직원 전체를 일괄 정산한다. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const b = await req.json();
    const nowP = kstParts(new Date());
    const year = num(b.year, nowP.year);
    const month = num(b.month, nowP.month);
    const confirm = b.confirm !== false;

    const employeeId = str(b.employeeId);
    const targets = employeeId
      ? [{ id: employeeId }]
      : await prisma.employee.findMany({
          where: { status: { in: ['ACTIVE', 'LEAVE'] } },
          select: { id: true },
        });
    if (targets.length === 0) return fail('정산할 직원이 없습니다.');

    const results = [];
    for (const t of targets) {
      const p = await upsertPayroll(t.id, year, month, {
        confirm,
        adminId: admin.userId,
        memo: str(b.memo),
      });
      results.push(p);
      await writeAudit(admin, {
        entity: 'payroll',
        entityId: p.id,
        action: confirm ? 'CONFIRM' : 'CALCULATE',
        after: {
          year, month, netTotal: p.netTotal, grossTotal: p.grossTotal,
          deductionTotal: p.deductionTotal, workDays: p.workDays,
        },
        ip: clientIp(req),
      });
    }
    return ok({ count: results.length, results });
  } catch (e) {
    return handleError(e);
  }
}
