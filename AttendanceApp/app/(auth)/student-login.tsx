import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Snackbar, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Student } from '../../types';
import * as Device from 'expo-device';

export default function StudentLogin() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [name, setName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!name || !enrollmentNo || !mobileNo) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Query student by enrollment number and mobile number
      const { data: students, error: queryError } = await supabase
        .from('student')
        .select('*')
        .eq('enrollment_no', enrollmentNo)
        .eq('mobile_no', mobileNo);

      if (queryError) {
        throw queryError;
      }

      if (!students || students.length === 0) {
        throw new Error('Student not found. Please verify your details.');
      }

      const student = students[0] as Student;

      // Verify name matches (case-insensitive)
      if (student.name.toLowerCase() !== name.toLowerCase()) {
        throw new Error('Name does not match enrollment records');
      }

      // Get device ID for binding
      const deviceId = Device.osBuildId ?? Device.modelId ?? 'unknown';

      // Check if this device is already bound to ANY student
      const { data: deviceUsers, error: deviceCheckError } = await supabase
        .from('student')
        .select('id, name')
        .eq('device_id', deviceId)
        .eq('is_device_bound', true);

      if (deviceCheckError) {
        throw deviceCheckError;
      }

      // If device is already bound to a different student, reject
      if (deviceUsers && deviceUsers.length > 0) {
        const boundStudentId = deviceUsers[0].id;
        if (boundStudentId !== student.id) {
          throw new Error(
            'This device is already linked to another student account. Please use a different device.'
          );
        }
      }

      // Device binding check - if this student is bound, verify it's the same device
      if (student.is_device_bound && student.device_id !== deviceId) {
        throw new Error(
          'This account is already linked to another device. Contact your HOD.'
        );
      }

      // First login: bind device
      if (!student.is_device_bound) {
        const { error: updateError } = await supabase
          .from('student')
          .update({
            device_id: deviceId,
            is_device_bound: true,
          })
          .eq('id', student.id);

        if (updateError) {
          throw updateError;
        }

        // Refetch updated student
        const { data: updatedStudent } = await supabase
          .from('student')
          .select('*')
          .eq('id', student.id)
          .single();

        if (updatedStudent) {
          setUser({
            role: 'student',
            data: updatedStudent as Student,
          });
        }
      } else {
        setUser({
          role: 'student',
          data: student,
        });
      }

      setLoading(false);
      router.replace('/(student)/mark-attendance');
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Login failed');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formContainer}>
        <Text variant="headlineLarge" style={styles.title}>
          Student Login
        </Text>

        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          style={styles.input}
          disabled={loading}
        />

        <TextInput
          label="Enrollment Number"
          value={enrollmentNo}
          onChangeText={setEnrollmentNo}
          placeholder="Enter your enrollment number"
          style={styles.input}
          disabled={loading}
        />

        <TextInput
          label="Mobile Number"
          value={mobileNo}
          onChangeText={setMobileNo}
          placeholder="Enter your mobile number"
          keyboardType="phone-pad"
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
