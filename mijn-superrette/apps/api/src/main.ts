import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap.js';
import type { AppConfig } from './config/config.js';
import { CONFIG } from './common/tokens.js';

async function main(): Promise<void> {
  const app = await createApp();
  const config = app.get<AppConfig>(CONFIG);
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`Mijn Superrette API listening on :${config.port} (${config.env})`, 'Bootstrap');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
