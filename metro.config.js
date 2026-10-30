// Configuración de Metro, el empaquetador de la app.
// https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// El servidor es un proyecto aparte, con sus propias dependencias: Metro no debe recorrerlo.
const servidor = path.resolve(__dirname, 'servidor').replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${servidor}[\\\\/].*`),
];

module.exports = config;
