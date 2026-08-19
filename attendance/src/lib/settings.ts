/** 시스템 설정 (근무시간, 계산 기준 등)을 DB에서 읽고 쓴다. */
import { prisma } from './prisma';
import { DEFAULT_WORK_SETTINGS, type WorkSettings } from './payroll';

export const SETTING_KEYS = {
  workStart: 'work.start',
  workEnd: 'work.end',
  breakStart: 'work.breakStart',
  breakEnd: 'work.breakEnd',
  standardMinutes: 'work.standardMinutes',
  lateThreshold: 'work.lateThreshold',
  nightStart: 'work.nightStart',
  nightEnd: 'work.nightEnd',
  autoCloseAfterHours: 'work.autoCloseAfterHours',
  companyName: 'company.name',
} as const;

export async function getWorkSettings(): Promise<WorkSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const str = (k: string, d: string) => map.get(k) ?? d;
  const num = (k: string, d: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  return {
    workStart: str(SETTING_KEYS.workStart, DEFAULT_WORK_SETTINGS.workStart),
    workEnd: str(SETTING_KEYS.workEnd, DEFAULT_WORK_SETTINGS.workEnd),
    breakStart: str(SETTING_KEYS.breakStart, DEFAULT_WORK_SETTINGS.breakStart),
    breakEnd: str(SETTING_KEYS.breakEnd, DEFAULT_WORK_SETTINGS.breakEnd),
    standardMinutes: num(SETTING_KEYS.standardMinutes, DEFAULT_WORK_SETTINGS.standardMinutes),
    lateThreshold: str(SETTING_KEYS.lateThreshold, DEFAULT_WORK_SETTINGS.lateThreshold),
    nightStart: str(SETTING_KEYS.nightStart, DEFAULT_WORK_SETTINGS.nightStart),
    nightEnd: str(SETTING_KEYS.nightEnd, DEFAULT_WORK_SETTINGS.nightEnd),
    autoCloseAfterHours: num(
      SETTING_KEYS.autoCloseAfterHours,
      DEFAULT_WORK_SETTINGS.autoCloseAfterHours,
    ),
  };
}

export async function getCompanyName(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.companyName } });
  return row?.value || '디자인재성';
}

export async function saveSettings(entries: Record<string, string>) {
  const ops = Object.entries(entries).map(([key, value]) =>
    prisma.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    }),
  );
  await prisma.$transaction(ops);
}
