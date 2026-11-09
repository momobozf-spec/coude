import { findWorkspaceById } from '@orbit/db';
import { AppShell } from '@/components/shell/app-shell';
import { getShellData } from '@/lib/shell-data';
import { requireServerSession } from '@/lib/session';

/** Alles onder deze layout vereist een sessie. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { scope, user } = await requireServerSession('/');
  const workspace = await findWorkspaceById(scope.db, scope.workspaceId);
  const shellData = await getShellData(scope, user.name, workspace?.name ?? 'Workspace');

  return <AppShell {...shellData}>{children}</AppShell>;
}
