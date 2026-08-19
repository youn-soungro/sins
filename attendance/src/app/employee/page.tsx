import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WorkPanel from './work-panel';

export const dynamic = 'force-dynamic';

export default async function EmployeeHome() {
  const session = await getSession();
  if (!session) redirect('/employee/login');
  if (session.role === 'ADMIN') redirect('/admin');
  if (!session.employeeId) redirect('/employee/login');

  const [workplaces, projects] = await Promise.all([
    prisma.workplace.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, radiusM: true },
    }),
    prisma.project.findMany({
      where: { status: { in: ['ONGOING', 'PLANNED'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, address: true, workplaceId: true },
    }),
  ]);

  return <WorkPanel employeeName={session.name} workplaces={workplaces} projects={projects} />;
}
