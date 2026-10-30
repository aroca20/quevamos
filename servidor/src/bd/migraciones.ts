export interface Migracion {
  nombre: string;
  sql: string;
}

/**
 * Cambios del esquema, en orden. Cada uno se aplica una sola vez.
 * Una migración ya publicada no se edita: cualquier cambio va en una migración nueva al final.
 */
export const MIGRACIONES: readonly Migracion[] = [
  {
    nombre: '001_cuentas',
    sql: `
CREATE TYPE estado_cuenta AS ENUM ('ACTIVA', 'SUSPENDIDA', 'ELIMINADA');

CREATE TABLE usuarios (
  id uuid PRIMARY KEY,
  -- El correo nunca se guarda en claro: un HMAC para buscarlo y una copia cifrada para escribir.
  email_hash bytea UNIQUE,
  email_cifrado bytea,
  nombre_visible text CHECK (char_length(nombre_visible) BETWEEN 1 AND 30),
  avatar_url text,
  mayor_edad_declarada_en timestamptz,
  zona_horaria text NOT NULL DEFAULT 'Europe/Madrid',
  verde_duracion_min smallint NOT NULL DEFAULT 60 CHECK (verde_duracion_min IN (30, 60, 120)),
  estado_cuenta estado_cuenta NOT NULL DEFAULT 'ACTIVA',
  eliminada_en timestamptz,
  creado_en timestamptz NOT NULL,
  actualizado_en timestamptz NOT NULL,
  ultima_actividad_en timestamptz NOT NULL,
  CHECK ((estado_cuenta = 'ELIMINADA') = (eliminada_en IS NOT NULL))
);

-- Códigos de acceso de un solo uso. cerrado_en: usado, sustituido por otro o bloqueado por intentos.
CREATE TABLE codigos_acceso (
  id uuid PRIMARY KEY,
  email_hash bytea NOT NULL,
  codigo_hash bytea NOT NULL,
  intentos smallint NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL,
  expira_en timestamptz NOT NULL,
  cerrado_en timestamptz
);
CREATE INDEX codigos_acceso_email ON codigos_acceso (email_hash, creado_en DESC);

CREATE TABLE sesiones (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  -- Solo el hash del token: quien lea la base de datos no puede suplantar a nadie.
  token_hash bytea NOT NULL UNIQUE,
  dispositivo text CHECK (char_length(dispositivo) <= 60),
  creada_en timestamptz NOT NULL,
  ultimo_uso_en timestamptz NOT NULL,
  expira_en timestamptz NOT NULL,
  revocada_en timestamptz
);
CREATE INDEX sesiones_usuario ON sesiones (usuario_id);
`,
  },
];
