// Metro configuration for the pnpm monorepo.
// Workspace packages are consumed as TypeScript source (package export
// condition "@superrette/source"); their ESM-style relative imports end in
// ".js", which we map back to the ".ts"/".tsx" source files.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_conditionNames = [...(config.resolver.unstable_conditionNames ?? ['require', 'import']), '@superrette/source'];

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstream ?? context.resolveRequest;
  if (moduleName.startsWith('.') && moduleName.endsWith('.js') && /[\\/]packages[\\/]/.test(context.originModulePath)) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform);
    } catch {
      // fall through to the default resolution
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
