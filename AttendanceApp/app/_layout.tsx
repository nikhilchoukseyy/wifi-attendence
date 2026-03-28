import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { NetworkOfflineBanner } from '../components/NetworkOfflineBanner';
import { setupAutoSync } from '../lib/offlineSync';

export default function RootLayout() {
  const { user } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = setupAutoSync();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!mounted) return; // ← wait until Slot is rendered

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/');
    } else if (user && inAuthGroup) {
      if (user.role === 'student') router.replace('/(student)/mark-attendance');
      else if (user.role === 'teacher') router.replace('/(teacher)/session');
      else if (user.role === 'hod') router.replace('/(hod)/dashboard');
    }


  }, [user, segments, mounted]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <StatusBar style="dark" />
          <NetworkOfflineBanner />
          <Slot />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
