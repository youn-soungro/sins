/** 설정 변경 후 최근 3개월 기록을 다시 계산한다. */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, handleError, ok, requireAdmin } from '@/lib/api';
import { recalcAttendance } from '@/lib/attendance-service';
import { getWorkSettings } from '@/lib/settings';
import { writeAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const settings = await getWorkSettings();

    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - 3);

    const rows = await prisma.attendance.findMany({
      where: { workDate: { gte: since }, checkInAt: { not: null } },
      select: { id: true },
    });
    for (const r of rows) await recalcAttendance(r.id, settings);

    await writeAudit(admin, {
      entity: 'attendance', entityId: 'BULK', action: 'RECALCULATE',
      after: { count: rows.length }, reason: '설정 변경에 따른 재계산', ip: clientIp(req),
    });
    return ok({ count: rows.length });
  } catch (e) {
    return handleError(e);
  }
}
