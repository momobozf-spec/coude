import { registerAdminTools } from './adminTools';
import { registerEmailTools } from './emailTools';
import { registerFinanceTools } from './financeTools';
import { registerOpsTools } from './opsTools';
import { registerProjectTools } from './projectTools';
import { TOOLS } from '../catalog';
import { ToolRegistry } from '../ToolRegistry';

/** Builds the registry with every catalog tool bound to its handler. */
export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registerAdminTools(registry);
  registerEmailTools(registry);
  registerFinanceTools(registry);
  registerProjectTools(registry);
  registerOpsTools(registry);
  const missing = TOOLS.map((t) => t.name).filter((name) => !registry.has(name));
  if (missing.length) throw new Error(`Tools without handler: ${missing.join(', ')}`);
  return registry;
}
