import { prisma } from '@/lib/prisma';
import { PageTitle } from '@/components/ui';
import { kstParts, kstDateStr } from '@/lib/time';
import ExcelPanel from './panel';

export const dynamic = 'force-dynamic';

export default async function ExcelPage() {
  const p = kstParts(new Date());
  const employees = await prisma.employee.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  const today = kstDateStr();

  return (
    <>
      <PageTitle
        title="엑셀 다운로드"
        desc="기간과 직원을 선택한 뒤 필요한 자료를 내려받으세요. 모든 파일은 합계 행이 포함됩니다."
      />
      <ExcelPanel
        employees={employees}
        defaultFrom={`${today.slice(0, 7)}-01`}
        defaultTo={today}
        year={p.year}
        month={p.month}
      />
    </>
  );
}
