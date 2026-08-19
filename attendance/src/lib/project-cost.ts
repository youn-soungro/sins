/**
 * 현장별 인건비 집계.
 * 현장 원가계산에 바로 쓸 수 있도록 투입 인원·공수·수당까지 합산한다.
 */
import { prisma } from './prisma';
import { dateOnly } from './time';
import { PROJECT_STATUS_LABEL } from './labels';
import { getWorkSettings } from './settings';

export interface ProjectCostRow {
  projectId: string;
  projectName: string;
  clientName: string | null;
  status: string;
  workerCount: number;
  /** 총 투입일 = 공수 (기본근무시간 기준으로 환산) */
  mandays: number;
  workDays: number;
  normalMinutes: number;
  overtimeMinutes: number;
  basePay: number;
  overtimePay: number;
  nightPay: number;
  mealTotal: number;
  lodgingTotal: number;
  vehicleTotal: number;
  otherAllowance: number;
  totalCost: number;
}

export async function getProjectCost(
  opts: { from?: string | null; to?: string | null; projectId?: string | null } = {},
): Promise<ProjectCostRow[]> {
  const settings = await getWorkSettings();
  const standard = settings.standardMinutes || 480;

  const dateWhere =
    opts.from || opts.to
      ? {
          workDate: {
            ...(opts.from ? { gte: dateOnly(opts.from) } : {}),
            ...(opts.to ? { lte: dateOnly(opts.to) } : {}),
          },
        }
      : {};

  const projects = await prisma.project.findMany({
    where: opts.projectId ? { id: opts.projectId } : {},
    include: {
      attendances: { where: dateWhere },
      allowances: { where: dateWhere },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
  });

  return projects.map((p) => {
    const atts = p.attendances.filter((a) => a.checkInAt);
    const workers = new Set(atts.map((a) => a.employeeId));

    const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0);
    const byType = (t: string) => sum(p.allowances.filter((a) => a.type === t), (a) => a.amount);

    const basePay = sum(atts, (a) => a.basePay);
    const overtimePay = sum(atts, (a) => a.overtimePay);
    const nightPay = sum(atts, (a) => a.nightPay);
    const allowanceTotal = sum(p.allowances, (a) => a.amount);
    const mealTotal = byType('MEAL');
    const lodgingTotal = byType('LODGING');
    const vehicleTotal = byType('VEHICLE');

    // 공수 = 실근무시간 합계 ÷ 기본근무시간
    const actualMinutes = sum(atts, (a) => a.actualMinutes);
    const mandays = Math.round((actualMinutes / standard) * 10) / 10;

    return {
      projectId: p.id,
      projectName: p.name,
      clientName: p.clientName,
      status: PROJECT_STATUS_LABEL[p.status],
      workerCount: workers.size,
      mandays,
      workDays: atts.length,
      normalMinutes: sum(atts, (a) => a.normalMinutes),
      overtimeMinutes: sum(atts, (a) => a.overtimeMinutes),
      basePay,
      overtimePay,
      nightPay,
      mealTotal,
      lodgingTotal,
      vehicleTotal,
      otherAllowance: allowanceTotal - mealTotal - lodgingTotal - vehicleTotal,
      totalCost: basePay + overtimePay + nightPay + allowanceTotal,
    };
  });
}
