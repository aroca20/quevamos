import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  COLORES,
  crearEstadoPersonalizado,
  esNombreReservado,
  limpiarNombre,
  LONGITUD_MAXIMA,
  NOMBRE_COLOR,
  NOMBRE_NIVEL,
  SIGNIFICADO,
  type ColorPersonalizado,
  type EstadoPersonalizado,
  type NivelVisible,
} from '../motor';
import { IconoEstado } from '../ui/IconoEstado';
import { tema } from '../ui/paleta';

const NIVELES: NivelVisible[] = ['verde', 'amarillo', 'rojo'];

const EXPLICACION: Record<NivelVisible, string> = {
  verde: 'Disponible: chat y avisos de proximidad con quien esté en Verde. Caduca, como el Verde.',
  amarillo: 'Depende: solo te llegan avisos breves.',
  rojo: 'No molestar: nadie puede escribirte.',
};

interface Props {
  visible: boolean;
  actual: EstadoPersonalizado | null;
  onCerrar: () => void;
  onGuardar: (nuevo: EstadoPersonalizado) => void;
  onBorrar: () => void;
}

/**
 * Hoja para crear o editar tu estado personalizado: nombre, color y con qué color funciona.
 * Parte de tu estado actual o de unos valores por defecto; la pantalla lo vuelve a montar en cada apertura.
 */
export function EditorEstado({ visible, actual, onCerrar, onGuardar, onBorrar }: Props) {
  const oscuro = useColorScheme() === 'dark';
  const t = tema(oscuro);
  const [nombre, setNombre] = useState(actual?.nombre ?? '');
  const [color, setColor] = useState<ColorPersonalizado>(actual?.color ?? 'lavanda');
  const [funcionaComo, setFuncionaComo] = useState<NivelVisible>(actual?.funcionaComo ?? 'amarillo');
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const borrador = crearEstadoPersonalizado(nombre, color, funcionaComo);
  const limpio = limpiarNombre(nombre);
  const ayuda = esNombreReservado(limpio)
    ? 'Ese nombre ya es de un estado del semáforo. Elige otro.'
    : `${Array.from(limpio).length}/${LONGITUD_MAXIMA} · Lo verán tus comunidades.`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCerrar}>
      <SafeAreaProvider>
        <SafeAreaView style={[estilos.pantalla, { backgroundColor: t.fondo }]}>
          <View style={[estilos.cabecera, { borderBottomColor: t.separador }]}>
            <Pressable onPress={onCerrar} accessibilityRole="button" hitSlop={8}>
              <Text style={[estilos.accion, { color: t.acento }]}>Cancelar</Text>
            </Pressable>
            <Text style={[estilos.tituloHoja, { color: t.texto }]} accessibilityRole="header">
              {actual ? 'Tu estado' : 'Crea tu estado'}
            </Text>
            <Pressable
              onPress={() => borrador && onGuardar(borrador)}
              disabled={!borrador}
              accessibilityRole="button"
              accessibilityState={{ disabled: !borrador }}
              hitSlop={8}
            >
              <Text style={[estilos.accion, estilos.negrita, { color: borrador ? t.acento : t.secundario }]}>
                Guardar
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
            <Text style={[estilos.seccion, { color: t.secundario }]}>NOMBRE</Text>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              maxLength={LONGITUD_MAXIMA}
              placeholder="Ej.: Entrenando"
              placeholderTextColor={t.secundario}
              autoCapitalize="sentences"
              autoCorrect={false}
              accessibilityLabel="Nombre de tu estado"
              style={[estilos.campo, { backgroundColor: t.tarjeta, color: t.texto, borderColor: t.separador }]}
            />
            <Text style={[estilos.pie, { color: t.secundario }]}>{ayuda}</Text>

            <Text style={[estilos.seccion, { color: t.secundario }]}>COLOR</Text>
            <View style={estilos.colores} accessibilityRole="radiogroup">
              {COLORES.map((opcion) => {
                const elegido = opcion === color;
                return (
                  <Pressable
                    key={opcion}
                    onPress={() => setColor(opcion)}
                    accessibilityRole="radio"
                    accessibilityLabel={NOMBRE_COLOR[opcion]}
                    accessibilityState={{ checked: elegido }}
                    style={[estilos.muestra, { borderColor: elegido ? t.texto : 'transparent' }]}
                  >
                    <IconoEstado aspecto={{ nivel: 'verde', color: opcion }} tamano={34} />
                  </Pressable>
                );
              })}
            </View>

            <Text style={[estilos.seccion, { color: t.secundario }]}>FUNCIONA COMO</Text>
            <View style={[estilos.grupo, { backgroundColor: t.tarjeta }]} accessibilityRole="radiogroup">
              {NIVELES.map((nivel, i) => {
                const elegido = nivel === funcionaComo;
                return (
                  <Pressable
                    key={nivel}
                    onPress={() => setFuncionaComo(nivel)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: elegido }}
                    style={[estilos.opcion, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.separador }]}
                  >
                    <IconoEstado aspecto={{ nivel, color: null }} tamano={24} />
                    <View style={estilos.flex}>
                      <Text style={[estilos.nombreOpcion, { color: t.texto }]}>{NOMBRE_NIVEL[nivel]}</Text>
                      <Text style={[estilos.pie, { color: t.secundario }]}>{EXPLICACION[nivel]}</Text>
                    </View>
                    <Text style={[estilos.marca, { color: elegido ? t.acento : 'transparent' }]}>✓</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[estilos.pie, { color: t.secundario }]}>
              Es lo que entienden los demás: decide si pueden escribirte, avisarte o verte cerca.
            </Text>

            <Text style={[estilos.seccion, { color: t.secundario }]}>ASÍ TE VERÁN</Text>
            <View style={[estilos.vista, { backgroundColor: t.tarjeta }]} accessible>
              <IconoEstado aspecto={{ nivel: funcionaComo, color }} tamano={30} />
              <View style={estilos.flex}>
                <Text style={[estilos.nombreOpcion, { color: t.texto }]}>{limpio || 'Tu estado'}</Text>
                <Text style={[estilos.pie, { color: t.secundario }]}>
                  Funciona como {NOMBRE_NIVEL[funcionaComo]}: {SIGNIFICADO[funcionaComo].toLowerCase()}
                </Text>
              </View>
            </View>

            {actual && !confirmarBorrado && (
              <Pressable onPress={() => setConfirmarBorrado(true)} accessibilityRole="button" hitSlop={8}>
                <Text style={[estilos.borrar, { color: t.peligro }]}>Borrar mi estado</Text>
              </Pressable>
            )}
            {actual && confirmarBorrado && (
              <View style={[estilos.confirmacion, { backgroundColor: t.tarjeta, borderColor: t.peligro }]}>
                <Text style={{ color: t.texto }}>
                  ¿Borrar tu estado? Donde lo uses pasará a verse {NOMBRE_NIVEL[actual.funcionaComo]}.
                </Text>
                <View style={estilos.botonesConfirmacion}>
                  <Pressable onPress={() => setConfirmarBorrado(false)} accessibilityRole="button" hitSlop={8}>
                    <Text style={[estilos.accion, { color: t.acento }]}>No</Text>
                  </Pressable>
                  <Pressable onPress={onBorrar} accessibilityRole="button" hitSlop={8}>
                    <Text style={[estilos.accion, estilos.negrita, { color: t.peligro }]}>Borrar</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  flex: { flex: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tituloHoja: { fontSize: 17, fontWeight: '700' },
  accion: { fontSize: 17 },
  negrita: { fontWeight: '700' },
  contenido: { padding: 16, gap: 8, paddingBottom: 48 },
  seccion: { fontSize: 13, fontWeight: '600', marginTop: 16, letterSpacing: 0.4 },
  campo: { fontSize: 17, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  pie: { fontSize: 13, lineHeight: 18 },
  colores: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  muestra: { padding: 4, borderRadius: 999, borderWidth: 2 },
  grupo: { borderRadius: 12, overflow: 'hidden' },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  nombreOpcion: { fontSize: 16, fontWeight: '700' },
  marca: { fontSize: 18, fontWeight: '700' },
  vista: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12 },
  borrar: { fontSize: 16, fontWeight: '600', marginTop: 24 },
  confirmacion: { marginTop: 24, padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  botonesConfirmacion: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24 },
});
