import { prisma } from '@/lib/prisma';
import { PageTitle } from '@/components/ui';
import { getWorkSettings } from '@/lib/settings';
import SettingsForm from './form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [settings, companyRow] = await Promise.all([
    getWorkSettings(),
    prisma.setting.findUnique({ where: { key: 'company.name' } }),
  ]);

  return (
    <>
      <PageTitle
        title="설정"
        desc="근무시간·휴게·지각 기준을 바꾸면 이후 계산에 반영됩니다. 이미 계산된 과거 기록은 재계산하지 않는 한 유지됩니다."
      />
      <SettingsForm settings={settings} companyName={companyRow?.value ?? '디자인재성'} />
    </>
  );
}
