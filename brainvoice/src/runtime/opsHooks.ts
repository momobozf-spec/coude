import { useAsyncData } from './hooks';
import { getRuntime, useAppStore } from './stores/appStore';
import type { AgentQuestion, Approval, Briefing, BriefingKind, Job, OpsNotification, Schedule, SystemHealth, Ticket } from '@core/domain/ops';
import type { MissionControlSummary, OpsClient, ProjectTicketCount, TicketDetail, TicketView } from '@core/ops/client';
import type { ActivityItem } from '@core/ops/services/ActivityService';

/** Mission Control data hooks. The client is local or HTTP depending on settings.ops.serverUrl. */

export function opsClient(): OpsClient {
  return getRuntime().opsHost.client();
}

export function useMissionControl() {
  return useAsyncData<MissionControlSummary>(() => opsClient().summary());
}

export function useOpsTickets(view: TicketView) {
  return useAsyncData<Ticket[]>(() => opsClient().tickets(view), [view]);
}

export function useOpsTicket(id: string | null) {
  return useAsyncData<TicketDetail | null>(() => (id ? opsClient().ticket(id) : Promise.resolve(null)), [id]);
}

export function useApprovals(status: 'PENDING' | 'all' = 'PENDING') {
  return useAsyncData<Approval[]>(() => opsClient().approvals(status), [status]);
}

export function useApproval(id: string | null) {
  return useAsyncData<Approval | null>(() => (id ? opsClient().approval(id) : Promise.resolve(null)), [id]);
}

export function useQuestions() {
  return useAsyncData<AgentQuestion[]>(() => opsClient().questions());
}

export function useSchedules() {
  return useAsyncData<Schedule[]>(() => opsClient().schedules());
}

export function useActivity(limit = 100) {
  return useAsyncData<ActivityItem[]>(() => opsClient().activity(limit), [limit]);
}

export function useSystemHealth() {
  return useAsyncData<SystemHealth>(() => opsClient().health());
}

export function useBriefing(kind: BriefingKind | null = null) {
  return useAsyncData<Briefing | null>(() => opsClient().briefing(kind ?? undefined), [kind]);
}

export function useOpsNotifications(limit = 50) {
  return useAsyncData<OpsNotification[]>(() => opsClient().notifications(limit), [limit]);
}

export function useFailedJobs() {
  return useAsyncData<Job[]>(() => opsClient().failedJobs());
}

export function useOpsProjects() {
  return useAsyncData<ProjectTicketCount[]>(() => opsClient().projects());
}

/** Runs a client mutation and refreshes every screen. */
export async function opsAction<T>(fn: (client: OpsClient) => Promise<T>): Promise<T> {
  const result = await fn(opsClient());
  useAppStore.getState().bumpData();
  return result;
}
