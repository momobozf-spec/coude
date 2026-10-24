import { describe, expect, it, vi } from 'vitest';
import { DevDeviceKeyCheck } from './dev-device-key.check';
import { DEV_DEVICE_KEY, hashDeviceKey } from './dev-device-key';

const config = (nodeEnv: string) => ({ get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined) });

describe('DevDeviceKeyCheck', () => {
  it('weigert te starten in productie als een winkel de dev-scannersleutel gebruikt', async () => {
    const count = vi.fn(async () => 1);
    const check = new DevDeviceKeyCheck({ store: { count } } as never, config('production') as never);
    await expect(check.onApplicationBootstrap()).rejects.toThrow(/dev-scannersleutel/);
    expect(count).toHaveBeenCalledWith({ where: { deviceKeyHash: hashDeviceKey(DEV_DEVICE_KEY) } });
  });

  it('start in productie zonder dev-sleutel, en controleert buiten productie niets', async () => {
    const count = vi.fn(async () => 0);
    await expect(new DevDeviceKeyCheck({ store: { count } } as never, config('production') as never).onApplicationBootstrap()).resolves.toBeUndefined();
    const devCount = vi.fn(async () => 1);
    await new DevDeviceKeyCheck({ store: { count: devCount } } as never, config('development') as never).onApplicationBootstrap();
    expect(devCount).not.toHaveBeenCalled();
  });
});
