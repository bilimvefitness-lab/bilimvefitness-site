const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add web-specific resolution if needed
if (config.resolver) {
  config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
}

module.exports = config;
