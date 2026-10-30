// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // El servidor tiene su propia configuración de estilo.
    ignores: ["dist/*", "servidor/**"],
  }
]);
