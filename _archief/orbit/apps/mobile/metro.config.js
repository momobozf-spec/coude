const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

/**
 * Metro in een monorepo.
 *
 * Standaard kijkt Metro alleen in de app-map. Deze twee aanpassingen laten hem
 * de workspace-packages als broncode meenemen (`watchFolders`) en zorgen dat
 * hij React maar één keer laadt (`nodeModulesPaths`); twee kopieën van React
 * levert anders de klassieke "invalid hook call" op.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// De packages worden als TypeScript gepubliceerd; Metro compileert ze mee.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
