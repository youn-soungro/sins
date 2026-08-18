/**
 * 퇴근 누락 자동 마감.
 * 관리자가 직접 실행하거나, 서버의 스케줄러(cron)에서 주기적으로 호출한다.
 *
 * cron 예시 (매일 새벽 4시):
 *   0 4 * * * curl -X POST -H "x-maintenance-key: $MAINTENANCE_KEY" http://localhost:3000/api/maintenance/auto-close
 */
import type { NextRequest } from 'next/server';
import { fail, handleError, ok } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { autoCloseStaleAttendances } from '@/lib/attendance-service';
import { notify } from '@/lib/notify';

export async function POST(req: NextRequest) {
  try {
    // 관리자 세션이거나, 서버 스케줄러 키가 맞아야 한다.
    const session = await getSession();
    const key = req.headers.get('x-maintenance-key');
    const expected = process.env.MAINTENANCE_KEY;
    const isCron = !!expected && key === expected;

    if (session?.role !== 'ADMIN' && !isCron) {
      return fail('권한이 없습니다.', 403);
    }

    const count = await autoCloseStaleAttendances();
    if (count > 0) {
      await notify({
        type: 'ETC',
        title: '퇴근 누락 자동마감',
        body: `${count}건의 미퇴근 기록을 자동 마감했습니다. 관리자 확인이 필요합니다.`,
      });
    }
    return ok({ count });
  } catch (e) {
    return handleError(e);
  }
}
