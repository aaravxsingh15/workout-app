const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite (wa-sqlite) as WebAssembly in a worker.
config.resolver.assetExts.push('wasm');

// The wasm worker needs cross-origin isolation in dev (Vercel gets the same headers from vercel.json).
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
