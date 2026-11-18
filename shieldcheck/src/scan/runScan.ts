import { Platform } from 'react-native';

import { runAppChecks } from './apps';
import { runNetworkChecks } from './network';
import { runSystemChecks } from './system';
import type { ScanReport } from './types';

/** Voert alle controles lokaal uit. Er wordt niets verstuurd. */
export async function runScan(): Promise<ScanReport> {
  const startedAt = Date.now();
  const [system, network] = await Promise.all([runSystemChecks(), runNetworkChecks()]);
  const apps = runAppChecks();
  // Korte minimale duur, zodat de laadstatus niet flikkert.
  const elapsed = Date.now() - startedAt;
  if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));
  return {
    startedAt,
    finishedAt: Date.now(),
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'other',
    results: [...system, ...apps, ...network],
  };
}
