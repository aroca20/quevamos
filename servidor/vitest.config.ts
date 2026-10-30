import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Con PostgreSQL de verdad, los archivos comparten base de datos: se ejecutan de uno en uno.
    fileParallelism: !process.env.DATABASE_URL_PRUEBAS,
  },
});
