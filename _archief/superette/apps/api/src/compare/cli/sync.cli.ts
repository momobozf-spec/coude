/**
 * Vult of ververst de supermarktvergelijker vanaf de commandoregel: draait
 * alle adapters (importbestanden of, buiten productie, demogegevens), matcht
 * producten, vult de geschiedenis, controleert alerts en verstuurt meldingen.
 *
 *   npm run db:seed:compare            # alle ketens
 *   npm run compare:sync -- lidl spar  # alleen deze adapters
 *
 * Draait via de tsc-build (niet via tsx): Nest heeft decorator-metadata nodig
 * voor constructor-injectie, en esbuild geeft die niet. Zie `apps/api/package.json`.
 *
 * Opnieuw uitvoerbaar: dezelfde gegevens twee keer laden geeft geen dubbele
 * rijen. Demogegevens dragen `source = DEMO` en worden in de app zo getoond.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CompareStandaloneModule } from '../compare-standalone.module';
import { SyncService } from '../jobs/sync.service';

async function main(): Promise<void> {
  const keys = process.argv.slice(2).filter((argument) => !argument.startsWith('-'));
  const app = await NestFactory.createApplicationContext(CompareStandaloneModule, { logger: ['error', 'warn', 'log'] });

  try {
    const summary = await app.get(SyncService).runSync({ keys });

    console.log('');
    for (const run of summary.imports) {
      const marker = run.status === 'SUCCEEDED' ? '✓' : run.status === 'PARTIAL' ? '△' : '✗';
      console.log(
        `${marker} ${run.adapterKey.padEnd(14)} ${run.status.padEnd(9)} ${String(run.productsSeen).padStart(4)} producten  ${String(run.offersUpserted).padStart(4)} aanbiedingen  ${String(run.historyAppended).padStart(4)} historie  ${String(run.matchesCreated).padStart(4)} matches  bron: ${run.source}`,
      );
      for (const error of run.errors.slice(0, 5)) console.log(`    · ${error}`);
      if (run.errors.length > 5) console.log(`    · … en ${run.errors.length - 5} meer`);
    }
    console.log(`\n${summary.expiredOffers} verlopen aanbiedingen gedeactiveerd`);
    console.log(`${summary.alerts.checked} alerts gecontroleerd, ${summary.alerts.triggered} geactiveerd`);
    console.log(`${summary.notifications.sent} meldingen verstuurd, ${summary.notifications.skipped} overgeslagen, ${summary.notifications.failed} mislukt`);
    console.log(`Klaar in ${summary.durationMs} ms\n`);

    if (summary.imports.some((run) => run.source === 'DEMO')) {
      console.log('LET OP: minstens één keten draait op DEMOGEGEVENS. Dit zijn geen echte winkelprijzen.\n');
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
