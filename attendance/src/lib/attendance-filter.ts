/**
 * 출퇴근 목록 조회 조건.
 * 화면 목록과 엑셀 다운로드가 완전히 같은 조건을 쓰도록 한 곳에서 만든다.
 */
import { str } from './api';
import { dateOnly } from './time';
import type { Prisma } from '@prisma/client';

export function buildWhere(sp: URLSearchParams): Prisma.AttendanceWhereInput {
  const from = str(sp.get('from'));
  const to = str(sp.get('to'));
  const employeeId = str(sp.get('employeeId'));
  const workplaceId = str(sp.get('workplaceId'));
  const projectId = str(sp.get('projectId'));
  const workType = str(sp.get('workType'));
  const status = str(sp.get('status'));
  const q = str(sp.get('q'));

  return {
    ...(from || to
      ? {
          workDate: {
            ...(from ? { gte: dateOnly(from) } : {}),
            ...(to ? { lte: dateOnly(to) } : {}),
          },
        }
      : {}),
    ...(employeeId && employeeId !== 'ALL' ? { employeeId } : {}),
    ...(workplaceId && workplaceId !== 'ALL' ? { workplaceId } : {}),
    ...(projectId && projectId !== 'ALL' ? { projectId } : {}),
    ...(workType && workType !== 'ALL' ? { workType: workType as never } : {}),
    ...(status && status !== 'ALL' ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { employee: { name: { contains: q, mode: 'insensitive' as const } } },
            { employee: { phone: { contains: q.replace(/\D/g, '') || q } } },
            { employee: { empNo: { contains: q, mode: 'insensitive' as const } } },
            { project: { name: { contains: q, mode: 'insensitive' as const } } },
            { workplace: { name: { contains: q, mode: 'insensitive' as const } } },
            { adminMemo: { contains: q, mode: 'insensitive' as const } },
            { employeeMemo: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}
