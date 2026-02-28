import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Button,
  Text,
  ActivityIndicator,
  Snackbar,
  Card,
  TextInput,
  Chip,
} from 'react-native-paper';
import * as Network from 'expo-network';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { extractSubnet } from '../../lib/utils';
import { AttendanceSession, Student } from '../../types';

export default function MarkAttendanceScreen() {
  const { user } = useAuthStore();
  const student = user?.data as Student;

  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [markedMessage, setMarkedMessage] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    checkForActiveSession();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      checkForActiveSession();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkForActiveSession = async () => {
    try {
      const { data: sessions, error: err } = await supabase
        .from('attendance_session')
        .select('*')
        .eq('is_active', true)
        .eq('year', student.year)
        .gt('opened_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Last 15 minutes
        .single();

      if (err && err.code === 'PGRST116') {
        // No matching records
        setActiveSession(null);
        setSessionExpired(false);
        return;
      }

      if (err) throw err;

      setActiveSession(sessions as AttendanceSession);
      setSessionExpired(false);
      setPin('');
      setMarkedMessage('');
    } catch (err: any) {
      console.error('Error checking for active session:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkForActiveSession();
    setRefreshing(false);
  };

  const handleMarkAttendance = async () => {
    if (!activeSession) {
      setError('No active session found');
      return;
    }

    if (!pin) {
      setError('Please enter the PIN');
      return;
    }

    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    if (pin !== activeSession.session_pin) {
      setError('Invalid PIN. Please try again.');
      setPin('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check student's IP subnet
      const ipAddress = await Network.getIpAddressAsync();
      const studentSubnet = extractSubnet(ipAddress);

      if (studentSubnet !== activeSession.router_subnet) {
        throw new Error(
          'You must be connected to the classroom WiFi network to mark attendance.'
        );
      }

      // Check if student already marked for this session
      const { data: existing, error: checkError } = await supabase
        .from('attendance_record')
        .select('id')
        .eq('session_id', activeSession.id)
        .eq('student_id', student.id)
        .single();

      if (existing) {
        setMarkedMessage('✓ You have already marked attendance for this session');
        setPin('');
        setLoading(false);
        return;
      }

      // Insert or update attendance record
      const { error: insertError } = await supabase
        .from('attendance_record')
        .upsert(
          {
            session_id: activeSession.id,
            student_id: student.id,
            status: 'present',
            marked_at: new Date().toISOString(),
            is_manual_edit: false,
          },
          { onConflict: 'session_id,student_id' }
        );

      if (insertError) throw insertError;

      setSuccess('✓ Attendance marked successfully!');
      setPin('');
      setMarkedMessage('✓ Attendance marked successfully! You can close this app.');

      // Auto-refresh session list
      setTimeout(() => {
        checkForActiveSession();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Student Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.label}>
              Logged in as
            </Text>
            <Text variant="titleMedium">{student.name}</Text>
            <Text variant="bodySmall" style={styles.enrollmentNo}>
              {student.enrollment_no}
            </Text>
          </Card.Content>
        </Card>

        {/* No Session State */}
        {!activeSession && !markedMessage && (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="headlineSmall" style={styles.emptyIcon}>
                ⏳
              </Text>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No Attendance Session
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Your teacher has not opened an attendance session yet. Check back in a moment or
                wait for your teacher to open a session.
              </Text>
              <Button mode="outlined" onPress={onRefresh} style={styles.refreshButton}>
                Refresh
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Active Session State */}
        {activeSession && !markedMessage && (
          <View style={styles.formContainer}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Attendance Session Active
            </Text>

            <Card style={styles.sessionCard}>
              <Card.Content>
                <Text variant="labelSmall" style={styles.label}>
                  Subject
                </Text>
                <Text variant="titleSmall">{activeSession.subject}</Text>
              </Card.Content>
            </Card>

            <Text variant="bodyMedium" style={styles.instructions}>
              Enter the 4-digit PIN displayed by your teacher to mark your attendance.
            </Text>

            <TextInput
              label="PIN (4 digits)"
              value={pin}
              onChangeText={setPin}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              style={styles.pinInput}
              disabled={loading}
              textAlign="center"
            />

            {loading ? (
              <ActivityIndicator size="large" style={styles.loader} />
            ) : (
              <Button
                mode="contained"
                onPress={handleMarkAttendance}
                style={styles.primaryButton}
                disabled={pin.length !== 4}
              >
                Mark Attendance
              </Button>
            )}

            <Text variant="labelSmall" style={styles.disclaimer}>
              ℹ️ Your device and IP address are being verified for security
            </Text>
          </View>
        )}

        {/* Success State */}
        {markedMessage && (
          <Card style={styles.successCard}>
            <Card.Content style={styles.successContent}>
              <Text variant="displaySmall" style={styles.successIcon}>
                ✓
              </Text>
              <Text variant="titleMedium" style={styles.successTitle}>
                Attendance Marked!
              </Text>
              <Text variant="bodyMedium" style={styles.successText}>
                {markedMessage}
              </Text>
              <Button mode="outlined" onPress={() => setMarkedMessage('')} style={styles.button}>
                Continue
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <Snackbar visible={!!error} onDismiss={() => setError('')} duration={4000}>
        {error}
      </Snackbar>
      <Snackbar visible={!!success} onDismiss={() => setSuccess('')} duration={3000}>
        {success}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
  },
  label: {
    color: '#666',
    marginBottom: 4,
  },
  enrollmentNo: {
    color: '#999',
    marginTop: 4,
  },
  emptyCard: {
    marginTop: 20,
    backgroundColor: '#fff9e6',
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  refreshButton: {
    marginTop: 16,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  sessionCard: {
    marginBottom: 16,
    backgroundColor: '#f0f7ff',
  },
  instructions: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  pinInput: {
    marginBottom: 16,
    fontSize: 24,
    letterSpacing: 8,
  },
  loader: {
    marginVertical: 20,
  },
  primaryButton: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  disclaimer: {
    textAlign: 'center',
    color: '#999',
    lineHeight: 18,
  },
  button: {
    marginTop: 16,
  },
  successCard: {
    marginTop: 20,
    backgroundColor: '#e8f5e9',
  },
  successContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    color: '#4caf50',
    marginBottom: 12,
  },
  successTitle: {
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  successText: {
    textAlign: 'center',
    color: '#388e3c',
    marginBottom: 20,
    lineHeight: 20,
  },
});
