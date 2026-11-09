import { todayFor } from '@orbit/api-core';
import { dashboardCounts, listProjectsWithProgress, listTags, type Scope } from '@orbit/db';
import type { ShellData } from '@/components/shell/app-shell';

/**
 * De gegevens die de omlijsting van de app nodig heeft: workspacenaam, tellers
 * in de sidebar, de projectenlijst en de tagnamen voor quick capture.
 *
 * Drie queries, parallel, bij elke paginalading. Zodra dit merkbaar wordt is de
 * volgende stap een cache per workspace die de sync-stream invalideert.
 */
export async function getShellData(scope: Scope, userName: string, workspaceName: string): Promise<ShellData> {
  const today = todayFor(scope);

  const [counts, projects, tags] = await Promise.all([
    dashboardCounts(scope, today),
    listProjectsWithProgress(scope, today),
    listTags(scope),
  ]);

  return {
    workspaceName,
    userName,
    timeZone: scope.timeZone,
    counts: { inbox: counts.inbox, today: counts.today, overdue: counts.overdue },
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      progress: project.progress.percent,
    })),
    tagNames: tags.map((tag) => tag.name),
  };
}
