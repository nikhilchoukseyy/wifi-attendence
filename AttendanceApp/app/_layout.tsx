import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { NetworkOfflineBanner } from '../components/NetworkOfflineBanner';

export default function RootLayout() {
  const { user } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    const inStudentGroup = segments[0] === '(student)';
    const inTeacherGroup = segments[0] === '(teacher)';
    const inHodGroup = segments[0] === '(hod)';

    if (!user && !inAuthGroup) {
      // No user, redirect to role selector
      router.replace('/');
    } else if (user) {
      // User exists, redirect to appropriate role screen
      if (inAuthGroup) {
        // Already authenticated, don't need to be on auth screens
        if (user.role === 'student') {
          router.replace('/(student)/mark-attendance');
        } else if (user.role === 'teacher') {
          router.replace('/(teacher)/session');
        } else if (user.role === 'hod') {
          router.replace('/(hod)/dashboard');
        }
      }
    }
  }, [user, segments]);

  return (
    <>
      <NetworkOfflineBanner />
      <Slot />
    </>
  );
}
