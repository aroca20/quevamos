import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NOMBRE_NIVEL, type EstadoDisponibilidad, type Nivel } from '../motor';
import { IconoEstado } from '../ui/IconoEstado';
import { borde, suave, tema, type Aspecto, type Tema } from '../ui/paleta';
import { EditorEstado } from './EditorEstado';
import { nivelDe, nombreDe, opciones, type ModeloAhora } from './modelo';
import { useAhora } from './useAhora';

const ETIQUETA: Record<Nivel, string> = {
  verde: 'Disponible',
  amarillo: 'Depende',
  rojo: 'No molestar',
  desconocido: 'No lo muestras',
};

const NOTA: Record<Nivel, string> = {
  verde: 'Puedes hablar con quien también esté en Verde contigo.',
  amarillo: 'Depende: solo te llegan avisos breves y tú decides si respondes.',
  rojo: 'Nadie puede escribirte ahora.',
  desconocido: 'Nadie ve tu estado, y tú tampoco ves el de los demás.',
};

function aspectoDe(modelo: ModeloAhora, estado: EstadoDisponibilidad): Aspecto {
  if (estado === 'personalizado' && modelo.personalizado) {
    return { nivel: modelo.personalizado.funcionaComo, color: modelo.personalizado.color };
  }
  return { nivel: nivelDe(modelo, estado), color: null };
}

function etiquetaDe(modelo: ModeloAhora, estado: EstadoDisponibilidad): string {
  if (estado === 'personalizado' && modelo.personalizado) {
    return `Como ${NOMBRE_NIVEL[modelo.personalizado.funcionaComo]}`;
  }
  return ETIQUETA[nivelDe(modelo, estado)];
}

function hora(fecha: Date): string {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

function detalleDe(modelo: ModeloAhora): string {
  if (modelo.esReposo) return 'Estado de reposo';
  if (!modelo.hasta) return 'Sin límite';
  return `Hasta las ${hora(modelo.hasta)}`;
}

/** Pantalla «Ahora»: tu estado actual y los estados para cambiarlo de un toque. */
export function AhoraScreen() {
  const oscuro = useColorScheme() === 'dark';
  const t = tema(oscuro);
  const insets = useSafeAreaInsets();
  const ahora = useAhora();
  const { modelo } = ahora;
  const [editorAbierto, setEditorAbierto] = useState(false);
  // Cambia en cada apertura para que el editor empiece siempre desde tu estado actual.
  const [aperturaEditor, setAperturaEditor] = useState(0);
  const [mostrarDeshacer, setMostrarDeshacer] = useState(false);
  // Cambia en cada elección para que la barra «Deshacer» cuente sus 5 segundos desde el último toque.
  const [ultimoCambio, setUltimoCambio] = useState(0);

  useEffect(() => {
    if (!mostrarDeshacer) return;
    const temporizador = setTimeout(() => setMostrarDeshacer(false), 5_000);
    return () => clearTimeout(temporizador);
  }, [mostrarDeshacer, ultimoCambio]);

  const elegir = (estado: EstadoDisponibilidad) => {
    ahora.elegir(estado);
    setMostrarDeshacer(true);
    setUltimoCambio((n) => n + 1);
  };

  const abrirEditor = () => {
    setAperturaEditor((n) => n + 1);
    setEditorAbierto(true);
  };

  const aspectoActual = aspectoDe(modelo, modelo.estado);
  let nota = NOTA[nivelDe(modelo, modelo.estado)];
  if (modelo.estado === 'personalizado' && modelo.personalizado) {
    nota = `Te ven como «${modelo.personalizado.nombre}», que funciona como ${NOMBRE_NIVEL[modelo.personalizado.funcionaComo]}. ${nota}`;
  }

  const botonEstado = (estado: EstadoDisponibilidad, compacto: boolean) => {
    const elegido = modelo.estado === estado;
    const aspecto = aspectoDe(modelo, estado);
    const nombre = nombreDe(modelo, estado);
    const etiqueta = etiquetaDe(modelo, estado);
    return (
      <Pressable
        key={estado}
        onPress={() => elegir(estado)}
        accessibilityRole="button"
        accessibilityLabel={`${nombre}, ${etiqueta}`}
        accessibilityState={{ selected: elegido }}
        style={({ pressed }) => [
          estilos.boton,
          compacto ? estilos.botonCompacto : estilos.botonGrande,
          {
            backgroundColor: elegido ? suave(aspecto, oscuro) : t.tarjeta,
            borderColor: elegido ? borde(aspecto, oscuro) : t.separador,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <IconoEstado aspecto={aspecto} tamano={28} />
        <View style={compacto ? estilos.textosIzquierda : estilos.textosCentro}>
          <Text style={[estilos.nombreBoton, compacto && estilos.izquierda, { color: t.texto }]} numberOfLines={2}>
            {nombre}
          </Text>
          <Text style={[estilos.etiquetaBoton, { color: t.secundario }]}>{etiqueta}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[estilos.pantalla, { backgroundColor: t.fondo }]}>
      <ScrollView contentContainerStyle={[estilos.contenido, { paddingBottom: 96 + insets.bottom }]}>
        <Text style={[estilos.titulo, { color: t.texto }]} accessibilityRole="header">
          Ahora
        </Text>

        <View
          accessible
          style={[
            estilos.tarjeta,
            { backgroundColor: suave(aspectoActual, oscuro), borderColor: borde(aspectoActual, oscuro) },
          ]}
        >
          <IconoEstado aspecto={aspectoActual} tamano={44} />
          <View style={estilos.flex}>
            <Text style={[estilos.antetitulo, { color: t.secundario }]}>TU ESTADO</Text>
            <Text style={[estilos.estadoActual, { color: t.texto }]}>{nombreDe(modelo, modelo.estado)}</Text>
            <Text style={[estilos.detalle, { color: t.secundario }]}>
              {etiquetaDe(modelo, modelo.estado)} · {detalleDe(modelo)}
            </Text>
          </View>
        </View>

        <View style={estilos.fila}>
          {botonEstado('verde', false)}
          {botonEstado('amarillo', false)}
          {modelo.personalizado ? (
            botonEstado('personalizado', false)
          ) : (
            <BotonCrear tema={t} onPress={abrirEditor} />
          )}
        </View>
        <View style={estilos.fila}>
          {botonEstado('rojo', true)}
          {botonEstado('desconocido', true)}
        </View>

        {!modelo.esReposo && (
          <View style={estilos.duraciones}>
            <Text style={[estilos.etiquetaDuracion, { color: t.secundario }]}>Duración</Text>
            {opciones(modelo, modelo.estado).map((opcion) => {
              const elegida = modelo.opcionElegida === opcion.id;
              return (
                <Pressable
                  key={opcion.id}
                  onPress={() => ahora.cambiarDuracion(opcion.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: elegida }}
                  style={[estilos.chip, { backgroundColor: elegida ? t.texto : t.tarjeta, borderColor: t.separador }]}
                >
                  <Text style={{ color: elegida ? t.fondo : t.texto, fontWeight: elegida ? '700' : '400' }}>
                    {opcion.etiqueta}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[estilos.nota, { color: t.secundario }]}>{nota}</Text>

        {modelo.personalizado && (
          <Pressable onPress={abrirEditor} accessibilityRole="button" hitSlop={8}>
            <Text style={[estilos.enlace, { color: t.acento }]}>Editar «{modelo.personalizado.nombre}»</Text>
          </Pressable>
        )}
      </ScrollView>

      {mostrarDeshacer && modelo.anterior && (
        <View
          accessibilityLiveRegion="polite"
          style={[estilos.barraDeshacer, { backgroundColor: t.tarjeta, borderColor: t.separador, bottom: 16 + insets.bottom }]}
        >
          <Text style={[estilos.flex, { color: t.texto }]}>
            {nombreDe(modelo, modelo.estado)} · {detalleDe(modelo).toLowerCase()}
          </Text>
          <Pressable
            onPress={() => {
              ahora.deshacer();
              setMostrarDeshacer(false);
            }}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[estilos.deshacer, { color: t.acento }]}>Deshacer</Text>
          </Pressable>
        </View>
      )}

      <EditorEstado
        key={aperturaEditor}
        visible={editorAbierto}
        actual={modelo.personalizado}
        onCerrar={() => setEditorAbierto(false)}
        onGuardar={(nuevo) => {
          ahora.guardarPersonalizado(nuevo);
          setEditorAbierto(false);
        }}
        onBorrar={() => {
          ahora.borrarPersonalizado();
          setEditorAbierto(false);
        }}
      />
    </SafeAreaView>
  );
}

/** Hueco del estado personalizado mientras no exista: abre el editor. */
function BotonCrear({ tema: t, onPress }: { tema: Tema; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Crear tu estado personalizado"
      style={({ pressed }) => [
        estilos.boton,
        estilos.botonGrande,
        { backgroundColor: t.tarjeta, borderColor: t.separador, borderStyle: 'dashed', opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[estilos.mas, { borderColor: t.secundario }]}>
        <Text style={[estilos.masTexto, { color: t.secundario }]}>+</Text>
      </View>
      <View style={estilos.textosCentro}>
        <Text style={[estilos.nombreBoton, { color: t.texto }]}>Tu estado</Text>
        <Text style={[estilos.etiquetaBoton, { color: t.secundario }]}>Créalo</Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: 16, gap: 16 },
  flex: { flex: 1 },
  titulo: { fontSize: 34, fontWeight: '800', marginTop: 8 },
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, borderWidth: 1.5 },
  antetitulo: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  estadoActual: { fontSize: 22, fontWeight: '800' },
  detalle: { fontSize: 15, fontVariant: ['tabular-nums'] },
  fila: { flexDirection: 'row', gap: 8 },
  boton: { flex: 1, borderRadius: 18, borderWidth: 1.5 },
  botonGrande: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 10 },
  botonCompacto: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  textosCentro: { alignItems: 'center' },
  textosIzquierda: { flex: 1 },
  nombreBoton: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  izquierda: { textAlign: 'left' },
  etiquetaBoton: { fontSize: 12 },
  duraciones: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  etiquetaDuracion: { fontSize: 13 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  nota: { fontSize: 15, lineHeight: 21 },
  enlace: { fontSize: 15, fontWeight: '600' },
  barraDeshacer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  deshacer: { fontSize: 15, fontWeight: '700' },
  mas: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  masTexto: { fontSize: 20, lineHeight: 22, fontWeight: '600' },
});
