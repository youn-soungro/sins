import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json();
    const before = await prisma.workplace.findUnique({ where: { id } });
    if (!before) return fail('근무지를 찾을 수 없습니다.', 404);

    const after = await prisma.workplace.update({
      where: { id },
      data: {
        ...(b.name !== undefined ? { name: String(b.name).trim() } : {}),
        ...(b.type !== undefined ? { type: b.type } : {}),
        ...(b.address !== undefined ? { address: str(b.address) } : {}),
        ...(b.lat !== undefined ? { lat: b.lat === '' || b.lat === null ? null : Number(b.lat) } : {}),
        ...(b.lng !== undefined ? { lng: b.lng === '' || b.lng === null ? null : Number(b.lng) } : {}),
        ...(b.radiusM !== undefined ? { radiusM: num(b.radiusM, 200) || 200 } : {}),
        ...(b.isActive !== undefined ? { isActive: !!b.isActive } : {}),
        ...(b.memo !== undefined ? { memo: str(b.memo) } : {}),
      },
    });
    await writeAudit(admin, {
      entity: 'workplaces', entityId: id, action: 'UPDATE',
      before, after, ip: clientIp(req),
    });
    return ok(after);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const used = await prisma.attendance.count({ where: { workplaceId: id } });
    if (used > 0) {
      // 기록이 있으면 삭제하지 않고 비활성화한다.
      const wp = await prisma.workplace.update({ where: { id }, data: { isActive: false } });
      await writeAudit(admin, {
        entity: 'workplaces', entityId: id, action: 'DEACTIVATE',
        after: wp, reason: `근무기록 ${used}건 존재`, ip: clientIp(req),
      });
      return ok({ deactivated: true, message: `근무기록 ${used}건이 있어 사용중지 처리했습니다.` });
    }
    await prisma.workplace.delete({ where: { id } });
    await writeAudit(admin, { entity: 'workplaces', entityId: id, action: 'DELETE', ip: clientIp(req) });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
