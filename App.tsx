import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AhoraScreen } from './src/ahora/AhoraScreen';

/** Punto de entrada de la app: de momento, solo la pantalla «Ahora». */
export default function App() {
  return (
    <SafeAreaProvider>
      <AhoraScreen />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
