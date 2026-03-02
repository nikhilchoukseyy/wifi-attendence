import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Teacher } from '../../types';
import * as Crypto from 'expo-crypto';

export default function TeacherLogin() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Query teacher by username
      const { data: teachers, error: queryError } = await supabase
        .from('teacher')
        .select('*')
        .eq('username', username);

      if (queryError) {
        throw queryError;
      }

      if (!teachers || teachers.length === 0) {
        throw new Error('Teacher not found');
      }

      const teacher = teachers[0] as Teacher & { password_hash: string };

      // Verify password
      const passwordMatch= await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );
      if (passwordMatch !== teacher.password_hash) {
        throw new Error('Invalid password');
      }

      // Set user in auth store (exclude password_hash)
      const { password_hash, ...teacherData } = teacher;
      setUser({
        role: 'teacher',
        data: teacherData as Teacher,
      });

      setLoading(false);
      router.replace('/(teacher)/session');
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Login failed');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formContainer}>
        <Text variant="headlineLarge" style={styles.title}>
          Teacher Login
        </Text>

        <TextInput
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="Enter your username"
          style={styles.input}
          disabled={loading}
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          style={styles.input}
          disabled={loading}
        />

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : (
          <Button
            mode="contained"
            onPress={handleLogin}
            style={styles.button}
          >
            Login
          </Button>
        )}

        <Button
          mode="text"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          Back
        </Button>
      </View>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError('')}
        duration={4000}
      >
        {error}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    justifyContent: 'center',
    minHeight: '100%',
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 20,
    paddingVertical: 8,
  },
  backButton: {
    marginTop: 12,
  },
  loader: {
    marginTop: 20,
  },
});
