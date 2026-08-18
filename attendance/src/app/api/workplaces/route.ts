/** 근무지 목록 / 등록 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp, fail, handleError, num, ok, requireAdmin, requireUser, str } from '@/lib/api';
import { writeAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireUser(); // 직원도 출근 시 근무지 목록이 필요하다.
    const includeInactive = req.nextUrl.searchParams.get('all') === '1';
    const rows = await prisma.workplace.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
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
    if (!name) return fail('근무지명을 입력해 주세요.');

    const created = await prisma.workplace.create({
      data: {
        name,
        type: (str(b.type) as never) ?? 'SITE',
        address: str(b.address),
        lat: b.lat !== undefined && b.lat !== '' ? Number(b.lat) : null,
        lng: b.lng !== undefined && b.lng !== '' ? Number(b.lng) : null,
        radiusM: num(b.radiusM, 200) || 200,
        memo: str(b.memo),
      },
    });
    await writeAudit(admin, {
      entity: 'workplaces', entityId: created.id, action: 'CREATE',
      after: created, ip: clientIp(req),
    });
    return ok(created);
  } catch (e) {
    return handleError(e);
  }
}
