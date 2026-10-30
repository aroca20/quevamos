import { describe, expect, it } from 'vitest';

import { migrar } from '../src/bd/migrar';
import { MIGRACIONES } from '../src/bd/migraciones';
import { MOTORES } from './ayudas';

describe.each(MOTORES)('Migraciones con $nombre', ({ abrir }) => {
  it('aplica las pendientes una sola vez', async () => {
    const bd = await abrir();
    try {
      expect(await migrar(bd)).toEqual(MIGRACIONES.map((m) => m.nombre));
      expect(await migrar(bd)).toEqual([]);
      const { rows } = await bd.query<{ tabla: string }>(
        "SELECT tablename AS tabla FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      );
      expect(rows.map((r) => r.tabla)).toEqual(['codigos_acceso', 'migraciones', 'sesiones', 'usuarios']);
    } finally {
      await bd.cerrar();
    }
  });

  it('si una migración falla, no deja nada a medias', async () => {
    const bd = await abrir();
    try {
      const rota = [{ nombre: '999_rota', sql: 'CREATE TABLE a_medias (id int); SELECT * FROM tabla_que_no_existe;' }];
      await expect(migrar(bd, rota)).rejects.toThrow();
      const { rows } = await bd.query("SELECT 1 FROM pg_tables WHERE tablename = 'a_medias'");
      expect(rows).toHaveLength(0);
      const aplicadas = await bd.query("SELECT 1 FROM migraciones WHERE nombre = '999_rota'");
      expect(aplicadas.rows).toHaveLength(0);
    } finally {
      await bd.cerrar();
    }
  });
});
