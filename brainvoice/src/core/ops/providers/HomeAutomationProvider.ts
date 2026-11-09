import type { HomeAction, HomeDevice, HomeSafetyLevel } from '../../domain/ops';
import { DomainError } from '../../types/common';

/**
 * HomeAutomationProvider seam (§178). The Null provider is what ships: not connected,
 * no devices, every action refused – Alfred never fakes a device. The Home Assistant
 * provider shows the exact REST calls; it needs a reachable instance and a long-lived
 * token (REQUIRES EXTERNAL HARDWARE / CREDENTIALS) and has not been run here.
 */

export interface HomeAutomationProvider {
  readonly id: string;
  readonly displayName: string;
  isConnected(): Promise<boolean>;
  listDevices(): Promise<HomeDevice[]>;
  getDevice(id: string): Promise<HomeDevice | null>;
  runAction(action: HomeAction): Promise<{ ok: boolean; detail: string | null }>;
}

const HIGH_DOMAINS = new Set(['lock', 'alarm_control_panel', 'siren', 'water_heater', 'valve', 'humidifier']);
const HIGH_WORDS = /\b(garage|gate|poort|oven|stove|cooktop|kookplaat|boiler|furnace|verwarmingsketel|gas|front ?door|voordeur|alarm|sprinkler|pool|zwembad|sauna)\b/i;
const MEDIUM_DOMAINS = new Set(['climate', 'cover', 'switch', 'fan', 'vacuum', 'script', 'automation', 'input_boolean', 'number', 'select']);
const LOW_DOMAINS = new Set(['light', 'media_player', 'scene', 'sensor', 'binary_sensor', 'weather', 'camera', 'person', 'sun', 'zone', 'calendar', 'todo', 'notify']);

/** Physical-safety class of a device: HIGH needs approval + explicit confirmation phrase, MEDIUM needs approval, LOW may run proactively. */
export function classifyDeviceSafety(domain: string, name: string): HomeSafetyLevel {
  const d = domain.toLowerCase();
  if (HIGH_DOMAINS.has(d) || HIGH_WORDS.test(name)) return 'HIGH';
  if (MEDIUM_DOMAINS.has(d)) return 'MEDIUM';
  if (LOW_DOMAINS.has(d)) return 'LOW';
  return 'MEDIUM';
}

export class NullHomeAutomationProvider implements HomeAutomationProvider {
  readonly id = 'none';
  readonly displayName = 'No home automation connected';

  async isConnected(): Promise<boolean> {
    return false;
  }

  async listDevices(): Promise<HomeDevice[]> {
    return [];
  }

  async getDevice(): Promise<HomeDevice | null> {
    return null;
  }

  async runAction(): Promise<{ ok: boolean; detail: string | null }> {
    throw new DomainError('HOME_NOT_CONNECTED', 'No home automation provider is connected');
  }
}

export interface HomeAssistantConfig {
  baseUrl: string;
  token: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface HassState {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
}

/**
 * Home Assistant REST provider: GET /api/states and POST /api/services/<domain>/<service>.
 * Status: READY FOR CLOUD DEPLOYMENT only once HASS_URL + HASS_TOKEN exist; REQUIRES
 * EXTERNAL HARDWARE to verify. Never claims devices that the instance did not report.
 */
export class HomeAssistantProvider implements HomeAutomationProvider {
  readonly id = 'home-assistant';
  readonly displayName = 'Home Assistant';

  constructor(private readonly config: HomeAssistantConfig) {}

  async isConnected(): Promise<boolean> {
    try {
      const response = await this.request('GET', '/api/');
      return response.ok;
    } catch {
      return false;
    }
  }

  async listDevices(): Promise<HomeDevice[]> {
    const response = await this.request('GET', '/api/states');
    if (!response.ok) throw new DomainError('HOME_NOT_CONNECTED', `Home Assistant answered ${response.status}`);
    const states = (await response.json()) as HassState[];
    return states.map(toDevice);
  }

  async getDevice(id: string): Promise<HomeDevice | null> {
    const response = await this.request('GET', `/api/states/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new DomainError('HOME_NOT_CONNECTED', `Home Assistant answered ${response.status}`);
    return toDevice((await response.json()) as HassState);
  }

  async runAction(action: HomeAction): Promise<{ ok: boolean; detail: string | null }> {
    const domain = action.deviceId.split('.')[0] ?? '';
    if (!domain || !/^[a-z_]+$/.test(domain) || !/^[a-z_]+$/.test(action.service)) throw new DomainError('INVALID_ARGUMENTS', 'Invalid device or service name');
    const response = await this.request('POST', `/api/services/${domain}/${action.service}`, { entity_id: action.deviceId, ...(action.data ?? {}) });
    return { ok: response.ok, detail: response.ok ? null : `Home Assistant answered ${response.status}` };
  }

  private async request(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<Response> {
    const token = await this.config.token();
    if (!token) throw new DomainError('HOME_NOT_CONNECTED', 'REQUIRES CREDENTIALS: no Home Assistant token configured');
    const fetchImpl = this.config.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) throw new DomainError('HOME_NOT_CONNECTED', 'fetch is not available');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000) : null;
    try {
      return await fetchImpl(`${this.config.baseUrl.replace(/\/$/, '')}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: controller?.signal });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function toDevice(state: HassState): HomeDevice {
  const domain = state.entity_id.split('.')[0] ?? 'unknown';
  const name = typeof state.attributes?.friendly_name === 'string' ? state.attributes.friendly_name : state.entity_id;
  return { id: state.entity_id, name, domain, state: state.state, safety: classifyDeviceSafety(domain, name), attributes: state.attributes ?? {} };
}

/** In-memory provider for tests: devices are whatever the test registered. */
export class InMemoryHomeProvider implements HomeAutomationProvider {
  readonly id = 'memory-home';
  readonly displayName = 'In-memory home';
  readonly actions: HomeAction[] = [];
  constructor(private readonly devices: HomeDevice[] = []) {}
  async isConnected(): Promise<boolean> {
    return true;
  }
  async listDevices(): Promise<HomeDevice[]> {
    return this.devices;
  }
  async getDevice(id: string): Promise<HomeDevice | null> {
    return this.devices.find((d) => d.id === id) ?? null;
  }
  async runAction(action: HomeAction): Promise<{ ok: boolean; detail: string | null }> {
    const device = this.devices.find((d) => d.id === action.deviceId);
    if (!device) return { ok: false, detail: 'unknown device' };
    this.actions.push(action);
    device.state = action.service.includes('off') || action.service === 'lock' ? 'off' : 'on';
    return { ok: true, detail: null };
  }
}
