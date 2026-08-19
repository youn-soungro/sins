/** 상태 점검용. 서버·DB 연결 확인에 사용한다. */
import { prisma } from '@/lib/prisma';
import { kstDateTimeStr } from '@/lib/time';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      db: 'connected',
      serverTimeKst: kstDateTimeStr(new Date()),
    });
  } catch {
    return Response.json({ ok: false, db: 'disconnected' }, { status: 503 });
  }
}
