/**
 * 알림 구조. 현재는 DB 에 적재하고 관리자 화면에서 확인한다.
 * 향후 카카오 알림톡 / 웹푸시 연동 시 sendExternal 만 구현하면 된다.
 */
import { prisma } from './prisma';
import type { NotificationType } from '@prisma/client';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  employeeId?: string | null;
  toAdmin?: boolean;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body,
        employeeId: input.employeeId ?? null,
        targetRole: input.toAdmin === false ? 'EMPLOYEE' : 'ADMIN',
      },
    });
    // await sendExternal(input);  // 향후 알림톡/푸시 연동 지점
  } catch (e) {
    console.error('[notify] 알림 생성 실패', e);
  }
}
