import type { BaseDatos } from '../../bd';
import type { Correo } from '../../correo';
import {
  cifrar,
  descifrar,
  generarCodigo,
  generarToken,
  hashToken,
  hmac,
  igualesSeguro,
  normalizarEmail,
  uuidv7,
} from '../../cripto';
import { errores } from '../../errores';

const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;

export const LIMITES_CUENTAS = {
  /** Cuánto vale un código de acceso. */
  vidaCodigo: 10 * MINUTO,
  /** Fallos permitidos antes de bloquear el código. */
  intentosPorCodigo: 5,
  /** Códigos que puede pedir una misma dirección en una hora. */
  codigosPorHora: 5,
  /** Una sesión caduca tras 90 días sin usarse. */
  vidaSesion: 90 * DIA,
  /** Cada cuánto se apunta el uso de la sesión (y se renueva su caducidad). */
  refrescoUso: 10 * MINUTO,
  /** Días entre el borrado de una cuenta y su purga definitiva. */
  purga: 30 * DIA,
} as const;

export interface Claves {
  /** Para buscar por correo y comprobar códigos sin guardarlos en claro. */
  hmac: Buffer;
  /** Para cifrar el correo. */
  cifrado: Buffer;
}

export interface Perfil {
  id: string;
  nombreVisible: string | null;
  mayorDeEdad: boolean;
  zonaHoraria: string;
  verdeDuracionMin: number;
  /** Con alias y mayoría de edad declarada. La app pide completarlo tras el primer acceso. */
  perfilCompleto: boolean;
  creadoEn: string;
}

export interface CambiosPerfil {
  nombreVisible?: string;
  mayorDeEdad?: true;
  zonaHoraria?: string;
  verdeDuracionMin?: 30 | 60 | 120;
}

export interface Sesion {
  sesionId: string;
  usuarioId: string;
}

export interface Acceso {
  token: string;
  usuario: Perfil;
  /** La cuenta se acaba de crear con este acceso. */
  nuevo: boolean;
}

export interface Exportacion {
  exportadoEn: string;
  cuenta: {
    id: string;
    correo: string | null;
    nombreVisible: string | null;
    mayorDeEdadDeclaradaEn: string | null;
    zonaHoraria: string;
    verdeDuracionMin: number;
    creadoEn: string;
    ultimaActividadEn: string;
  };
  sesiones: {
    dispositivo: string | null;
    creadaEn: string;
    ultimoUsoEn: string;
    expiraEn: string;
    revocadaEn: string | null;
    actual: boolean;
  }[];
}

interface FilaUsuario {
  id: string;
  nombre_visible: string | null;
  mayor_edad_declarada_en: Date | null;
  zona_horaria: string;
  verde_duracion_min: number;
  creado_en: Date;
  estado_cuenta: string;
}

const COLUMNAS_USUARIO =
  'id, nombre_visible, mayor_edad_declarada_en, zona_horaria, verde_duracion_min, creado_en, estado_cuenta';

function aPerfil(fila: FilaUsuario): Perfil {
  const mayorDeEdad = fila.mayor_edad_declarada_en !== null;
  return {
    id: fila.id,
    nombreVisible: fila.nombre_visible,
    mayorDeEdad,
    zonaHoraria: fila.zona_horaria,
    verdeDuracionMin: fila.verde_duracion_min,
    perfilCompleto: fila.nombre_visible !== null && mayorDeEdad,
    creadoEn: fila.creado_en.toISOString(),
  };
}

const iso = (fecha: Date | null): string | null => (fecha ? fecha.toISOString() : null);

/** Cuentas, acceso sin contraseña con código por correo, sesiones, exportación y borrado. */
export class ServicioCuentas {
  private readonly bd: BaseDatos;
  private readonly claves: Claves;
  private readonly correo: Correo;
  private readonly reloj: () => Date;

  constructor(bd: BaseDatos, claves: Claves, correo: Correo, reloj: () => Date = () => new Date()) {
    this.bd = bd;
    this.claves = claves;
    this.correo = correo;
    this.reloj = reloj;
  }

  private emailHash(emailNormalizado: string): Buffer {
    return hmac(this.claves.hmac, `correo:${emailNormalizado}`);
  }

  private codigoHash(emailHash: Buffer, codigo: string): Buffer {
    return hmac(this.claves.hmac, `codigo:${emailHash.toString('hex')}:${codigo}`);
  }

  /**
   * Envía un código de seis cifras. La respuesta es la misma exista o no la cuenta,
   * para que nadie pueda averiguar quién está registrado.
   */
  async solicitarCodigo(email: string): Promise<void> {
    const ahora = this.reloj();
    const destino = normalizarEmail(email);
    const emailHash = this.emailHash(destino);
    const codigo = generarCodigo();
    const permitido = await this.bd.transaccion(async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM codigos_acceso WHERE email_hash = $1 AND creado_en > $2',
        [emailHash, new Date(ahora.getTime() - 60 * MINUTO)],
      );
      if ((rows[0]?.n ?? 0) >= LIMITES_CUENTAS.codigosPorHora) return false;
      // Solo vale el último código pedido.
      await tx.query('UPDATE codigos_acceso SET cerrado_en = $2 WHERE email_hash = $1 AND cerrado_en IS NULL', [
        emailHash,
        ahora,
      ]);
      await tx.query(
        `INSERT INTO codigos_acceso (id, email_hash, codigo_hash, creado_en, expira_en)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          uuidv7(ahora.getTime()),
          emailHash,
          this.codigoHash(emailHash, codigo),
          ahora,
          new Date(ahora.getTime() + LIMITES_CUENTAS.vidaCodigo),
        ],
      );
      return true;
    });
    if (!permitido) throw errores.demasiadasPeticiones();
    await this.correo.enviarCodigo(destino, codigo);
  }

  /** Comprueba el código. Si la cuenta no existe, la crea. Devuelve un token de sesión nuevo. */
  async verificarCodigo(email: string, codigo: string, dispositivo?: string): Promise<Acceso> {
    const ahora = this.reloj();
    const destino = normalizarEmail(email);
    const emailHash = this.emailHash(destino);
    const resultado = await this.bd.transaccion(async (tx) => {
      const { rows } = await tx.query<{ id: string; codigo_hash: Uint8Array; intentos: number }>(
        `SELECT id, codigo_hash, intentos FROM codigos_acceso
         WHERE email_hash = $1 AND cerrado_en IS NULL AND expira_en > $2
         ORDER BY creado_en DESC LIMIT 1 FOR UPDATE`,
        [emailHash, ahora],
      );
      const pendiente = rows[0];
      if (!pendiente) return { ok: false as const, motivo: 'codigo' as const };

      if (!igualesSeguro(pendiente.codigo_hash, this.codigoHash(emailHash, codigo))) {
        // El fallo se guarda aunque la petición termine en error: la transacción no se deshace.
        const intentos = pendiente.intentos + 1;
        const bloqueado = intentos >= LIMITES_CUENTAS.intentosPorCodigo;
        await tx.query('UPDATE codigos_acceso SET intentos = $2, cerrado_en = $3 WHERE id = $1', [
          pendiente.id,
          intentos,
          bloqueado ? ahora : null,
        ]);
        return { ok: false as const, motivo: 'codigo' as const };
      }
      await tx.query('UPDATE codigos_acceso SET cerrado_en = $2 WHERE id = $1', [pendiente.id, ahora]);

      const existente = await tx.query<FilaUsuario>(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE email_hash = $1`, [
        emailHash,
      ]);
      let usuario = existente.rows[0];
      if (usuario && usuario.estado_cuenta !== 'ACTIVA') return { ok: false as const, motivo: 'suspendida' as const };

      const nuevo = usuario === undefined;
      if (!usuario) {
        const creado = await tx.query<FilaUsuario>(
          `INSERT INTO usuarios (id, email_hash, email_cifrado, creado_en, actualizado_en, ultima_actividad_en)
           VALUES ($1, $2, $3, $4, $4, $4)
           RETURNING ${COLUMNAS_USUARIO}`,
          [uuidv7(ahora.getTime()), emailHash, cifrar(this.claves.cifrado, destino), ahora],
        );
        usuario = creado.rows[0];
        if (!usuario) throw new Error('No se ha podido crear la cuenta.');
      }

      const token = generarToken();
      await tx.query(
        `INSERT INTO sesiones (id, usuario_id, token_hash, dispositivo, creada_en, ultimo_uso_en, expira_en)
         VALUES ($1, $2, $3, $4, $5, $5, $6)`,
        [
          uuidv7(ahora.getTime()),
          usuario.id,
          hashToken(token),
          dispositivo ?? null,
          ahora,
          new Date(ahora.getTime() + LIMITES_CUENTAS.vidaSesion),
        ],
      );
      await tx.query('UPDATE usuarios SET ultima_actividad_en = $2 WHERE id = $1', [usuario.id, ahora]);
      return { ok: true as const, acceso: { token, usuario: aPerfil(usuario), nuevo } };
    });
    if (!resultado.ok) {
      throw resultado.motivo === 'suspendida' ? errores.cuentaSuspendida() : errores.codigoInvalido();
    }
    return resultado.acceso;
  }

  /** Devuelve la sesión del token, o null si no vale. Renueva la caducidad al usarla. */
  async autenticar(token: string): Promise<Sesion | null> {
    if (!token || token.length > 100) return null;
    const ahora = this.reloj();
    const { rows } = await this.bd.query<{ id: string; usuario_id: string; ultimo_uso_en: Date }>(
      `SELECT s.id, s.usuario_id, s.ultimo_uso_en
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = $1 AND s.revocada_en IS NULL AND s.expira_en > $2 AND u.estado_cuenta = 'ACTIVA'`,
      [hashToken(token), ahora],
    );
    const sesion = rows[0];
    if (!sesion) return null;
    if (ahora.getTime() - sesion.ultimo_uso_en.getTime() >= LIMITES_CUENTAS.refrescoUso) {
      await this.bd.query('UPDATE sesiones SET ultimo_uso_en = $2, expira_en = $3 WHERE id = $1', [
        sesion.id,
        ahora,
        new Date(ahora.getTime() + LIMITES_CUENTAS.vidaSesion),
      ]);
      await this.bd.query('UPDATE usuarios SET ultima_actividad_en = $2 WHERE id = $1', [sesion.usuario_id, ahora]);
    }
    return { sesionId: sesion.id, usuarioId: sesion.usuario_id };
  }

  async perfil(usuarioId: string): Promise<Perfil> {
    const { rows } = await this.bd.query<FilaUsuario>(
      `SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = $1 AND estado_cuenta = 'ACTIVA'`,
      [usuarioId],
    );
    const usuario = rows[0];
    if (!usuario) throw errores.noAutenticado();
    return aPerfil(usuario);
  }

  /** La mayoría de edad solo se puede declarar, no retirar. */
  async actualizarPerfil(usuarioId: string, cambios: CambiosPerfil): Promise<Perfil> {
    const ahora = this.reloj();
    const { rows } = await this.bd.query<FilaUsuario>(
      `UPDATE usuarios SET
         nombre_visible = COALESCE($2, nombre_visible),
         mayor_edad_declarada_en = CASE
           WHEN $3::boolean AND mayor_edad_declarada_en IS NULL THEN $6::timestamptz
           ELSE mayor_edad_declarada_en END,
         zona_horaria = COALESCE($4, zona_horaria),
         verde_duracion_min = COALESCE($5, verde_duracion_min),
         actualizado_en = $6
       WHERE id = $1 AND estado_cuenta = 'ACTIVA'
       RETURNING ${COLUMNAS_USUARIO}`,
      [
        usuarioId,
        cambios.nombreVisible ?? null,
        cambios.mayorDeEdad === true,
        cambios.zonaHoraria ?? null,
        cambios.verdeDuracionMin ?? null,
        ahora,
      ],
    );
    const usuario = rows[0];
    if (!usuario) throw errores.noAutenticado();
    return aPerfil(usuario);
  }

  async cerrarSesion(sesionId: string): Promise<void> {
    await this.bd.query('UPDATE sesiones SET revocada_en = $2 WHERE id = $1 AND revocada_en IS NULL', [
      sesionId,
      this.reloj(),
    ]);
  }

  /** Todos los datos de la cuenta, para el derecho de acceso y portabilidad. Nunca incluye tokens. */
  async exportar(usuarioId: string, sesionActual: string): Promise<Exportacion> {
    const cuenta = await this.bd.query<{
      id: string;
      email_cifrado: Uint8Array | null;
      nombre_visible: string | null;
      mayor_edad_declarada_en: Date | null;
      zona_horaria: string;
      verde_duracion_min: number;
      creado_en: Date;
      ultima_actividad_en: Date;
    }>(
      `SELECT id, email_cifrado, nombre_visible, mayor_edad_declarada_en, zona_horaria, verde_duracion_min,
              creado_en, ultima_actividad_en
       FROM usuarios WHERE id = $1 AND estado_cuenta = 'ACTIVA'`,
      [usuarioId],
    );
    const fila = cuenta.rows[0];
    if (!fila) throw errores.noAutenticado();
    const sesiones = await this.bd.query<{
      id: string;
      dispositivo: string | null;
      creada_en: Date;
      ultimo_uso_en: Date;
      expira_en: Date;
      revocada_en: Date | null;
    }>(
      `SELECT id, dispositivo, creada_en, ultimo_uso_en, expira_en, revocada_en
       FROM sesiones WHERE usuario_id = $1 ORDER BY creada_en`,
      [usuarioId],
    );
    return {
      exportadoEn: this.reloj().toISOString(),
      cuenta: {
        id: fila.id,
        correo: fila.email_cifrado ? descifrar(this.claves.cifrado, fila.email_cifrado) : null,
        nombreVisible: fila.nombre_visible,
        mayorDeEdadDeclaradaEn: iso(fila.mayor_edad_declarada_en),
        zonaHoraria: fila.zona_horaria,
        verdeDuracionMin: fila.verde_duracion_min,
        creadoEn: fila.creado_en.toISOString(),
        ultimaActividadEn: fila.ultima_actividad_en.toISOString(),
      },
      sesiones: sesiones.rows.map((s) => ({
        dispositivo: s.dispositivo,
        creadaEn: s.creada_en.toISOString(),
        ultimoUsoEn: s.ultimo_uso_en.toISOString(),
        expiraEn: s.expira_en.toISOString(),
        revocadaEn: iso(s.revocada_en),
        actual: s.id === sesionActual,
      })),
    };
  }

  /**
   * Borra la cuenta: quita al momento el correo y el alias, cierra todas las sesiones y deja
   * la fila anónima hasta la purga definitiva, 30 días después.
   */
  async borrarCuenta(usuarioId: string): Promise<{ purgaDefinitivaEn: string }> {
    const ahora = this.reloj();
    await this.bd.transaccion(async (tx) => {
      await tx.query('DELETE FROM codigos_acceso WHERE email_hash = (SELECT email_hash FROM usuarios WHERE id = $1)', [
        usuarioId,
      ]);
      await tx.query(
        `UPDATE usuarios SET estado_cuenta = 'ELIMINADA', eliminada_en = $2, actualizado_en = $2,
           email_hash = NULL, email_cifrado = NULL, nombre_visible = NULL, avatar_url = NULL
         WHERE id = $1 AND estado_cuenta <> 'ELIMINADA'`,
        [usuarioId, ahora],
      );
      await tx.query('UPDATE sesiones SET revocada_en = $2 WHERE usuario_id = $1 AND revocada_en IS NULL', [
        usuarioId,
        ahora,
      ]);
    });
    return { purgaDefinitivaEn: new Date(ahora.getTime() + LIMITES_CUENTAS.purga).toISOString() };
  }

  /** Elimina para siempre las cuentas borradas hace más de 30 días. Irá en una tarea diaria. */
  async purgarCuentasEliminadas(): Promise<number> {
    const limite = new Date(this.reloj().getTime() - LIMITES_CUENTAS.purga);
    const { rows } = await this.bd.query<{ id: string }>(
      "DELETE FROM usuarios WHERE estado_cuenta = 'ELIMINADA' AND eliminada_en < $1 RETURNING id",
      [limite],
    );
    return rows.length;
  }
}
