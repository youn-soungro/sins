/** 출퇴근 기록 목록 (관리자) — 통합검색·필터 지원 */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleError, ok, requireAdmin } from '@/lib/api';
import { buildWhere } from '@/lib/attendance-filter';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const where = buildWhere(sp);

    const rows = await prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, empNo: true, phone: true } },
        workplace: { select: { name: true, type: true } },
        project: { select: { id: true, name: true } },
        breaks: true,
      },
      orderBy: [{ workDate: 'desc' }, { checkInAt: 'desc' }],
      take: Number(sp.get('take')) || 500,
    });
    return ok(rows);
  } catch (e) {
    return handleError(e);
  }
}
