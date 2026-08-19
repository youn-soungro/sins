/** 현장 목록 / 등록 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, ok, requireAdmin, requireUser, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';
import { dateOnly } from '@/lib/time';

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const q = str(sp.get('q'));
    const status = str(sp.get('status'));
    const rows = await prisma.project.findMany({
      where: {
        ...(status && status !== 'ALL' ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { clientName: { contains: q, mode: 'insensitive' as const } },
                { address: { contains: q, mode: 'insensitive' as const } },
                { manager: { contains: q, mode: 'insensitive' as const } },
                { memo: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }, { name: 'asc' }],
    });
    return ok(rows);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const b = await req.json();
    const name = str(b.name);
    if (!name) return fail('현장명을 입력해 주세요.');

    const created = await prisma.project.create({
      data: {
        name,
        clientName: str(b.clientName),
        address: str(b.address),
        manager: str(b.manager),
        managerPhone: str(b.managerPhone),
        startDate: str(b.startDate) ? dateOnly(str(b.startDate)!) : null,
        endDate: str(b.endDate) ? dateOnly(str(b.endDate)!) : null,
        status: (str(b.status) as never) ?? 'ONGOING',
        memo: str(b.memo),
        workplaceId: str(b.workplaceId),
      },
    });
    await writeAudit(admin, {
      entity: 'projects', entityId: created.id, action: 'CREATE', after: created, ip: clientIp(req),
    });
    return ok(created);
  } catch (e) {
    return handleError(e);
  }
}
