import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function RoleSelector() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="headlineLarge" style={styles.title}>
          Attendance System
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Select your role to continue
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            size="large"
            onPress={() => router.push('/(auth)/student-login')}
            style={styles.button}
          >
            I am a Student
          </Button>

          <Button
            mode="contained"
            size="large"
            onPress={() => router.push('/(auth)/teacher-login')}
            style={styles.button}
          >
            I am a Teacher
          </Button>

          <Button
            mode="contained"
            size="large"
            onPress={() => router.push('/(auth)/hod-login')}
            style={styles.button}
          >
            I am a HOD
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 8,
  },
});
