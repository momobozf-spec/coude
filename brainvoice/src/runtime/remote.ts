import { getRuntime } from './stores/appStore';
import type { RemoteMethod } from '@core/ops/remote';

/**
 * Administrative data access that follows the Alfred mode: in local mode the call runs
 * against this phone's services, in connected mode it goes to the server (same allow-list,
 * same arguments). Screens never touch `services.*` for administrative data directly.
 */
export async function adminCall<T>(method: RemoteMethod, ...args: unknown[]): Promise<T> {
  return (await getRuntime().opsHost.client().call(method, args)) as T;
}
