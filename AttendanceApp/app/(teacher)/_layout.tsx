import React from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';

export default function TeacherLayout() {
  const router = useRouter();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <Tabs
      screenOptions={({ route }: any) => ({
        tabBarIcon: ({ color, size }: any) => {
          let iconName = 'check';

          if (route.name === 'session') {
            iconName = 'clock';
          } else if (route.name === 'students') {
            iconName = 'account-multiple';
          } else if (route.name === 'filter') {
            iconName = 'filter';
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
        headerShown: true,
        headerRight: () => (
          <IconButton
            icon="logout"
            onPress={handleLogout}
            style={{ marginRight: 8 }}
          />
        ),
      })}
    >
      <Tabs.Screen
        name="session"
        options={{ title: 'Session' }}
      />
      <Tabs.Screen
        name="students"
        options={{ title: 'Students' }}
      />
      <Tabs.Screen
        name="filter"
        options={{ title: 'Filter' }}
      />
    </Tabs>
  );
}
