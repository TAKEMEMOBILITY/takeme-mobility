const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root and shared package for changes
config.watchFolders = [monorepoRoot];

// Resolve modules from both the project and monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Monorepo: prevent walking up directories to resolve modules
config.resolver.disableHierarchicalLookup = true;

// ── Stripe TurboModule stub for Expo Go ──
// @stripe/stripe-react-native uses TurboModules (NativeStripeSdkModule) that
// don't exist in Expo Go. Metro still tries to resolve them at bundle time.
// We intercept the resolution and provide an empty module for native specs
// when they can't be found.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept native TurboModule specs from Stripe
  if (moduleName.includes('NativeStripeSdk') || moduleName.includes('NativeFinancialConnections')) {
    // Check if the file actually exists — if not, provide an empty module
    try {
      if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      // Module not found — return empty module
      return {
        type: 'empty',
      };
    }
  }

  // Default resolution for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
