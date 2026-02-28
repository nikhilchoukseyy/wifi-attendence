import React from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';

export default function HODLayout() {
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
          let iconName = 'home';

          if (route.name === 'dashboard') {
            iconName = 'home';
          } else if (route.name === 'manage-students') {
            iconName = 'account-multiple';
          } else if (route.name === 'manage-teachers') {
            iconName = 'school';
          } else if (route.name === 'download-pdf') {
            iconName = 'file-pdf';
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
        name="dashboard"
        options={{ title: 'Dashboard' }}
      />
      <Tabs.Screen
        name="manage-students"
        options={{ title: 'Students' }}
      />
      <Tabs.Screen
        name="manage-teachers"
        options={{ title: 'Teachers' }}
      />
      <Tabs.Screen
        name="download-pdf"
        options={{ title: 'Reports' }}
      />
    </Tabs>
  );
}
