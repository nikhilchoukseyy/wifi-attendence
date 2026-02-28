import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <StatusBar barStyle="dark-content" />
          {/* Expo Router handles routing via app.json plugin */}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
