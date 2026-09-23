export interface AgencySettings {
  alertMinScore: number;
  digestEnabled: boolean;
  digestHourLocal: number;
  timezone: string;
  telegramChatId: string | null;
  crmRetentionDays: number | null;
  dormantMonths: number;
  autoAssignByAgent: boolean;
}
