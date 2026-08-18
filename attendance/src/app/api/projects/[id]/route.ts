import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireAdmin, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { dateOnly } from '@/lib/time';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const b = await req.json();
    const before = await prisma.project.findUnique({ where: { id } });
    if (!before) return fail('현장을 찾을 수 없습니다.', 404);

    const after = await prisma.project.update({
      where: { id },
      data: {
        ...(b.name !== undefined ? { name: String(b.name).trim() } : {}),
        ...(b.clientName !== undefined ? { clientName: str(b.clientName) } : {}),
        ...(b.address !== undefined ? { address: str(b.address) } : {}),
        ...(b.manager !== undefined ? { manager: str(b.manager) } : {}),
        ...(b.managerPhone !== undefined ? { managerPhone: str(b.managerPhone) } : {}),
        ...(b.startDate !== undefined ? { startDate: b.startDate ? dateOnly(String(b.startDate)) : null } : {}),
        ...(b.endDate !== undefined ? { endDate: b.endDate ? dateOnly(String(b.endDate)) : null } : {}),
        ...(b.status !== undefined ? { status: b.status } : {}),
        ...(b.memo !== undefined ? { memo: str(b.memo) } : {}),
        ...(b.workplaceId !== undefined ? { workplaceId: str(b.workplaceId) } : {}),
      },
    });
    await writeAudit(admin, { entity: 'projects', entityId: id, action: 'UPDATE', before, after, ip: clientIp(req) });
    return ok(after);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const used = await prisma.attendance.count({ where: { projectId: id } });
    if (used > 0) {
      const p = await prisma.project.update({ where: { id }, data: { status: 'DONE' } });
      await writeAudit(admin, {
        entity: 'projects', entityId: id, action: 'CLOSE',
        after: p, reason: `근무기록 ${used}건 존재`, ip: clientIp(req),
      });
      return ok({ closed: true, message: `근무기록 ${used}건이 있어 '완료' 처리했습니다.` });
    }
    await prisma.project.delete({ where: { id } });
    await writeAudit(admin, { entity: 'projects', entityId: id, action: 'DELETE', ip: clientIp(req) });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
