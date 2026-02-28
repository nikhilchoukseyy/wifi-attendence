import React from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@react-native-vector-icons/MaterialCommunityIcons';
import { IconButton } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';

export default function StudentLayout() {
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

          if (route.name === 'mark-attendance') {
            iconName = 'check-circle';
          } else if (route.name === 'my-attendance') {
            iconName = 'file-document';
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
        name="mark-attendance"
        options={{ title: 'Mark Attendance' }}
      />
      <Tabs.Screen
        name="my-attendance"
        options={{ title: 'My Attendance' }}
      />
    </Tabs>
  );
}
