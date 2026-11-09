import { Alert } from 'react-native';

import { getRuntime, useAppStore } from './stores/appStore';
import { buildToolCommand } from '@core/butler/AdminParser';
import { getTool, type ToolArgs, type ToolName } from '@core/butler/catalog';
import type { ToolPayload } from '@core/butler/payloads';
import type { ActionResult } from '@core/commands/ActionRouter';
import { explainError } from '@core/errors/messages';
import type { CommandBatch } from '@core/intent/schema';
import { newId } from '@core/util/id';
import { adminUi } from '@ui/adminI18n';

/**
 * Runs a Butler tool from a screen button. The press is the user's explicit instruction,
 * so the command goes straight to the router (history, undo and focus still apply);
 * external tools (sending email) additionally ask for a final confirmation (§96, §134).
 */
export async function runTool<N extends ToolName>(name: N, args: ToolArgs<N>, options: { confirmMessage?: string | null } = {}): Promise<ActionResult | null> {
  const rt = getRuntime();
  const language = rt.language();
  const definition = getTool(name);
  if (!definition) return null;
  const command = buildToolCommand({ tool: name, args: args as Record<string, unknown>, language, originalText: `[ui] ${name}`, confidence: 1, parser: 'manual' });
  if (!command) {
    Alert.alert(explainError('INVALID_ARGUMENTS', language));
    return null;
  }
  if (definition.permission === 'external' || options.confirmMessage) {
    const strings = adminUi(language);
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(options.confirmMessage ?? strings.sendConfirm, definition.permission === 'external' ? strings.sendHint : undefined, [
        { text: strings.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: strings.confirm, onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return null;
  }
  const batch: CommandBatch = { id: newId(), commands: [command], originalText: command.originalText, transcript: null, language, source: 'text', createdAt: rt.clock.nowISO() };
  const [result] = await rt.router.execute(batch);
  useAppStore.getState().bumpData();
  if (result && !result.ok && result.error) Alert.alert(explainError(result.error.code, language), __DEV__ ? result.error.message : undefined);
  return result ?? null;
}

export function toolPayloadOf(result: ActionResult | null): ToolPayload | null {
  return result?.payload?.kind === 'tool' ? result.payload.payload : null;
}
