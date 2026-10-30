import { Text, View, useColorScheme } from 'react-native';

import { borde, glifo, relleno, type Aspecto } from './paleta';

/**
 * Icono de cada estado. El color nunca va solo: la forma dice qué permite.
 * Un estado personalizado usa su color, pero la forma del nivel con el que funciona.
 */
export function IconoEstado({ aspecto, tamano = 28 }: { aspecto: Aspecto; tamano?: number }) {
  const oscuro = useColorScheme() === 'dark';
  const colorGlifo = glifo(aspecto, oscuro);
  const barra = { backgroundColor: colorGlifo, borderRadius: tamano * 0.06 };

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        backgroundColor: relleno(aspecto, oscuro),
        borderWidth: aspecto.color ? Math.max(2, tamano * 0.09) : 0,
        borderColor: borde(aspecto, oscuro),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {aspecto.nivel === 'amarillo' && (
        <View style={{ flexDirection: 'row', gap: tamano * 0.12 }}>
          <View style={[barra, { width: tamano * 0.12, height: tamano * 0.44 }]} />
          <View style={[barra, { width: tamano * 0.12, height: tamano * 0.44 }]} />
        </View>
      )}
      {aspecto.nivel === 'rojo' && <View style={[barra, { width: tamano * 0.5, height: tamano * 0.12 }]} />}
      {aspecto.nivel === 'desconocido' && (
        <Text style={{ color: colorGlifo, fontSize: tamano * 0.6, lineHeight: tamano * 0.72, fontWeight: '900' }}>
          ?
        </Text>
      )}
    </View>
  );
}
