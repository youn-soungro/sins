import type { NextRequest } from 'next/server';
import { clientIp, handleError, ok, requireAdmin, str } from '@/lib/api';
import { getWorkSettings, saveSettings, SETTING_KEYS } from '@/lib/settings';
import { writeAudit } from '@/lib/audit';

export async function GET() {
  try {
    await requireAdmin();
    return ok(await getWorkSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const b = await req.json();
    const before = await getWorkSettings();

    const entries: Record<string, string> = {};
    const map: Array<[string, string]> = [
      ['companyName', SETTING_KEYS.companyName],
      ['workStart', SETTING_KEYS.workStart],
      ['workEnd', SETTING_KEYS.workEnd],
      ['breakStart', SETTING_KEYS.breakStart],
      ['breakEnd', SETTING_KEYS.breakEnd],
      ['standardMinutes', SETTING_KEYS.standardMinutes],
      ['lateThreshold', SETTING_KEYS.lateThreshold],
      ['nightStart', SETTING_KEYS.nightStart],
      ['nightEnd', SETTING_KEYS.nightEnd],
      ['autoCloseAfterHours', SETTING_KEYS.autoCloseAfterHours],
    ];
    for (const [field, key] of map) {
      const v = str(b[field]);
      if (v !== null) entries[key] = v;
    }
    await saveSettings(entries);

    await writeAudit(admin, {
      entity: 'settings', entityId: 'work', action: 'UPDATE',
      before, after: await getWorkSettings(), ip: clientIp(req),
    });
    return ok(await getWorkSettings());
  } catch (e) {
    return handleError(e);
  }
}
