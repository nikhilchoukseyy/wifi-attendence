import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { HOD } from '../../types';

export default function HODLogin() {
  const router = useRouter();
  const { setUser, setLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoadingLocal] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoadingLocal(true);
    setError('');

    try {
      
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (!data.user) {
        throw new Error('Login failed');
      }

      // Fetch HOD profile from hod table
      const { data: hodProfile, error: hodError } = await supabase
        .from('hod')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (hodError) {
        console.error('Error fetching HOD profile:', hodError);
        throw new Error('HOD profile not found');
      }

      // Set user in auth store
      setUser({
        role: 'hod',
        data: hodProfile as HOD,
      });

      setLoadingLocal(false);
      router.replace('/(hod)/dashboard');
    } catch (err: any) {
      setLoadingLocal(false);
      setError(err.message || 'Login failed');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formContainer}>
        <Text variant="headlineLarge" style={styles.title}>
          HOD Login
        </Text>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
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
