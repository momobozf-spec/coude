import type { HomeAction, HomeDevice, HomeSafetyLevel } from '../../domain/ops';
import { DomainError } from '../../types/common';
import type { HomeAutomationProvider } from '../providers/HomeAutomationProvider';
import type { OpsSettings } from '../settings';

export interface HomeActionPlan {
  device: HomeDevice;
  safety: HomeSafetyLevel;
  requiresApproval: boolean;
  /** HIGH safety: the approval must repeat the device name as confirmation text. */
  requiresConfirmationText: boolean;
  reason: string;
}

/**
 * Home automation rules (§178). Devices come from the provider only – when nothing is
 * connected there are no devices and every action is refused. Physical-safety classes:
 * LOW may run proactively, MEDIUM needs an approval, HIGH needs an approval whose
 * confirmation text repeats the device name.
 */
export class HomeService {
  constructor(
    private readonly provider: () => HomeAutomationProvider,
    private readonly settings: () => OpsSettings,
  ) {}

  async status(): Promise<{ providerId: string; displayName: string; connected: boolean }> {
    const p = this.provider();
    return { providerId: p.id, displayName: p.displayName, connected: await p.isConnected().catch(() => false) };
  }

  async listDevices(): Promise<HomeDevice[]> {
    const p = this.provider();
    if (!(await p.isConnected().catch(() => false))) return [];
    return p.listDevices();
  }

  async plan(action: HomeAction): Promise<HomeActionPlan> {
    const p = this.provider();
    if (!(await p.isConnected().catch(() => false))) throw new DomainError('HOME_NOT_CONNECTED');
    const device = await p.getDevice(action.deviceId);
    if (!device) throw new DomainError('NOT_FOUND', `Unknown device ${action.deviceId} – Alfred never assumes devices that the provider did not report`);
    const autonomy = this.settings().autonomy;
    const requiresApproval = device.safety !== 'LOW' || autonomy === 'ASSISTANT';
    const reason = device.safety === 'HIGH' ? 'affects physical safety (lock, alarm, heat, gas, garage…)' : device.safety === 'MEDIUM' ? 'changes the physical environment' : autonomy === 'ASSISTANT' ? 'ASSISTANT mode: every change waits for approval' : 'low-impact device';
    return { device, safety: device.safety, requiresApproval, requiresConfirmationText: device.safety === 'HIGH', reason };
  }

  /** Executes after the registry/approval gate; `confirmed` comes from a durable approval or an explicit user confirmation. */
  async run(action: HomeAction, options: { confirmed: boolean; confirmText?: string | null }): Promise<{ device: HomeDevice; ok: boolean; detail: string | null }> {
    const plan = await this.plan(action);
    if (plan.requiresApproval && !options.confirmed) throw new DomainError('APPROVAL_REQUIRED', `${plan.device.name}: ${plan.reason}`);
    if (plan.requiresConfirmationText) {
      const expected = plan.device.name.trim().toLowerCase();
      if ((options.confirmText ?? '').trim().toLowerCase() !== expected) throw new DomainError('HOME_SAFETY', `Repeat the device name "${plan.device.name}" to confirm this action`);
    }
    const result = await this.provider().runAction(action);
    return { device: plan.device, ok: result.ok, detail: result.detail };
  }
}
