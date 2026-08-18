/** 근무지 반경을 벗어난 출근을 관리자가 승인한다. */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json().catch(() => ({}));

    const att = await prisma.attendance.findUnique({ where: { id } });
    if (!att) return fail('기록을 찾을 수 없습니다.', 404);

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        checkInGps: 'APPROVED',
        gpsApprovedBy: admin.name,
        gpsApprovedAt: new Date(),
        adminMemo: [att.adminMemo, `GPS 반경이탈 승인 (${admin.name})`].filter(Boolean).join('\n'),
      },
    });
    await writeAudit(admin, {
      entity: 'attendance',
      entityId: id,
      action: 'APPROVE_GPS',
      before: { checkInGps: att.checkInGps, distanceM: att.checkInDistanceM },
      after: { checkInGps: updated.checkInGps },
      reason: str(b.reason),
      ip: clientIp(req),
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
