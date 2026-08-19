/**
 * 감사 로그. 출퇴근/급여 등 민감한 데이터 변경은 반드시 이 함수를 통해 기록한다.
 * 기록은 절대 삭제하지 않는다.
 */
import { prisma } from './prisma';
import type { SessionUser } from './auth';

export interface AuditInput {
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
}

export async function writeAudit(actor: SessionUser | null, input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        beforeJson: input.before ? JSON.parse(JSON.stringify(input.before)) : undefined,
        afterJson: input.after ? JSON.parse(JSON.stringify(input.after)) : undefined,
        actorId: actor?.userId ?? null,
        actorName: actor?.name ?? null,
        actorRole: actor?.role ?? null,
        reason: input.reason ?? null,
        ip: input.ip ?? null,
      },
    });
  } catch (e) {
    // 감사 로그 실패가 본 작업을 막지 않도록 한다. (로그만 남긴다)
    console.error('[audit] 기록 실패', e);
  }
}

/** 감사로그에 남길 필드만 추린다. (비밀번호 등 민감정보 제외) */
export function pickAuditFields<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  fields: (keyof T)[],
): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = obj[f];
    out[String(f)] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}
