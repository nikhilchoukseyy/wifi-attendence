import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useNavigation } from 'expo-router';
import {
  Button,
  Text,
  ActivityIndicator,
  Snackbar,
  Card,
  TextInput,
} from 'react-native-paper';
import * as Network from 'expo-network';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { extractSubnet } from '../../lib/utils';
import FaceCamera from '../../components/FaceCamera';
import { AttendanceSession, Student } from '../../types';
import { verifyFaceWithBackend } from '../../lib/faceApi';

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
  const [step, setStep] = useState<'pin' | 'face' | 'done'>('pin');
  const [faceVerifying, setFaceVerifying] = useState(false);
  const [faceError, setFaceError] = useState('');

  useEffect(() => {
    if (!student) return;
    checkForActiveSession();
    const interval = setInterval(checkForActiveSession, 30000);
    return () => clearInterval(interval);
  }, [student?.id]);

  const navigation = useNavigation();

  useEffect(() => {
    if (step === 'face') {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    } else {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    }
  }, [step]);

  if (!student) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading student data...</Text>
      </View>
    );
  }

  const checkForActiveSession = async () => {
    if (!student) return;
    try {
      const { data: session, error: err } = await supabase
        .from('attendance_session')
        .select('*')
        .eq('is_active', true)
        .eq('year', student.year)
        .gt('expires_at', new Date().toISOString())
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) throw err;

      setActiveSession(session as AttendanceSession | null);
      if (!session) return;
      setPin('');
      setMarkedMessage('');
      setStep('pin');
    } catch (err: any) {
      console.error('Error checking for active session:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkForActiveSession();
    setRefreshing(false);
  };

  const handlePinSubmit = () => {
    if (!activeSession) return;
    if (!pin || pin.length !== 4) { setError('PIN must be 4 digits'); return; }
    if (pin !== activeSession.session_pin) {
      setError('Invalid PIN. Please try again.');
      setPin('');
      return;
    }
    setFaceError('');
    setStep('face');
  };

  // ✅ FIXED: Fresh signed URL + Face++ verification
  const handleFaceVerified = async (capturedPhotoUri: string) => {
    setFaceVerifying(true);
    setFaceError('');

    try {
      // Step 1: face_registered check karo
      const { data, error } = await supabase
        .from('student')
        .select('face_registered')
        .eq('id', student.id)
        .single();

      if (error) throw error;

      if (!data?.face_registered) {
        throw new Error('Face not registered. Please contact your HOD.');
      }

      // Step 2: Fresh signed URL generate karo (10 min valid)
      // Stored URL kabhi expire ho jaata hai — isliye hamesha fresh URL lo
      const { data: signedData, error: signedError } = await supabase.storage
        .from('face-photos')
        .createSignedUrl(`${student.id}/reference.jpg`, 600);

      if (signedError || !signedData?.signedUrl) {
        throw new Error('Could not load reference photo. Try again.');
      }

      // Step 3: Face++ se verify karo
      const matched = await verifyFaceWithBackend(
        capturedPhotoUri,
        signedData.signedUrl  // ✅ fresh URL, never expired
      );

      if (!matched) {
        throw new Error('Face does not match. Try in better lighting.');
      }

      // Step 4: Attendance mark karo
      await markAttendanceInDB();

    } catch (err: any) {
      setFaceError(err.message || 'Face verification failed.');
      setFaceVerifying(false);
    }
  };

  const markAttendanceInDB = async () => {
    setLoading(true);
    try {
      // WiFi subnet check
      const ipAddress = await Network.getIpAddressAsync();
      const studentSubnet = extractSubnet(ipAddress);
      if (studentSubnet !== activeSession!.router_subnet) {
        throw new Error('You must be connected to the classroom WiFi network.');
      }

      // Already marked check
      const { data: existing } = await supabase
        .from('attendance_record')
        .select('id, status')
        .eq('session_id', activeSession!.id)
        .eq('student_id', student.id)
        .maybeSingle();

      if (existing?.status === 'present') {
        setError('✓ You have already marked attendance for this session.');
        setFaceVerifying(false);
        setLoading(false);
        setStep('pin');
        return;
      }

      // Attendance record insert
      const { error: insertError } = await supabase
        .from('attendance_record')
        .upsert(
          {
            session_id: activeSession!.id,
            student_id: student.id,
            status: 'present',
            marked_at: new Date().toISOString(),
            is_manual_edit: false,
            face_verified: true,
            sync_status: 'synced',
          },
          { onConflict: 'session_id,student_id' }
        );

      if (insertError) throw insertError;

      setSuccess('✓ Attendance marked successfully!');
      setMarkedMessage('✓ Attendance marked successfully! You can close this app.');
      setStep('done');
      setTimeout(checkForActiveSession, 2000);
    } catch (err: any) {
      setFaceError(err.message || 'Failed to mark attendance.');
    } finally {
      setLoading(false);
      setFaceVerifying(false);
    }
  };

  if (step === 'face' && activeSession) {
    return (
      <View style={styles.fullScreenContainer}>
        <View style={styles.faceHeader}>
          <Button
            mode="text"
            textColor="#fff"
            onPress={() => { setStep('pin'); setFaceError(''); setFaceVerifying(false); }}
          >
            ← Back
          </Button>
          <Text style={styles.faceHeaderTitle}>📸 Face Verification</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={styles.faceStepRow}>
          <View style={[styles.stepDot, styles.stepDotDone]} />
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>
        <View style={styles.faceStepLabels}>
          <Text style={styles.stepLabelDone}>1. PIN ✓</Text>
          <Text style={styles.stepLabelActive}>2. Verify Face</Text>
        </View>

        <View style={styles.cameraFlex}>
          <FaceCamera
            instruction="Look directly at the camera, then tap capture"
            onCapture={handleFaceVerified}
            onError={(msg) => { setFaceError(msg); setFaceVerifying(false); }}
          />
        </View>

        {faceVerifying && (
          <View style={styles.verifyingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.verifyingText}>Verifying your face...</Text>
          </View>
        )}

        {faceError ? (
          <View style={styles.faceErrorBar}>
            <Text style={styles.faceErrorText}>❌ {faceError}</Text>
            <Button
              mode="contained"
              onPress={() => { setFaceError(''); setFaceVerifying(false); }}
              style={{ marginTop: 8 }}
            >
              Try Again
            </Button>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.label}>Logged in as</Text>
            <Text variant="titleMedium">{student.name}</Text>
            <Text variant="bodySmall" style={styles.enrollmentNo}>{student.enrollment_no}</Text>
          </Card.Content>
        </Card>

        {!activeSession && step !== 'done' && (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="headlineSmall" style={styles.emptyIcon}>⏳</Text>
              <Text variant="titleMedium" style={styles.emptyTitle}>No Attendance Session</Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Your teacher has not opened an attendance session yet.
              </Text>
              <Button mode="outlined" onPress={onRefresh} style={styles.refreshButton}>
                Refresh
              </Button>
            </Card.Content>
          </Card>
        )}

        {activeSession && step === 'pin' && (
          <View style={styles.formContainer}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Attendance Session Active
            </Text>

            <Card style={styles.sessionCard}>
              <Card.Content>
                <Text variant="labelSmall" style={styles.label}>Subject</Text>
                <Text variant="titleSmall">{activeSession.subject}</Text>
              </Card.Content>
            </Card>

            <StepIndicator currentStep={1} />

            <Text variant="bodyMedium" style={styles.instructions}>
              Enter the 4-digit PIN shown by your teacher.
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

            <Button
              mode="contained"
              onPress={handlePinSubmit}
              style={styles.primaryButton}
              disabled={pin.length !== 4}
            >
              Next: Verify Face →
            </Button>

            <Text variant="labelSmall" style={styles.disclaimer}>
              ℹ️ PIN + Face + WiFi verification required
            </Text>
          </View>
        )}

        {step === 'done' && (
          <Card style={styles.successCard}>
            <Card.Content style={styles.successContent}>
              <Text variant="displaySmall" style={styles.successIcon}>✓</Text>
              <Text variant="titleMedium" style={styles.successTitle}>Attendance Marked!</Text>
              <Text variant="bodyMedium" style={styles.successText}>{markedMessage}</Text>
              <Button
                mode="outlined"
                onPress={() => { setMarkedMessage(''); setStep('pin'); }}
                style={styles.button}
              >
                Done
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

function StepIndicator({ currentStep }: { currentStep: 1 | 2 }) {
  return (
    <View style={indicatorStyles.wrapper}>
      <View style={indicatorStyles.row}>
        <View style={[indicatorStyles.dot, currentStep === 1 && indicatorStyles.dotActive, currentStep === 2 && indicatorStyles.dotDone]} />
        <View style={[indicatorStyles.line, currentStep === 2 && indicatorStyles.lineDone]} />
        <View style={[indicatorStyles.dot, currentStep === 2 && indicatorStyles.dotActive]} />
      </View>
      <View style={indicatorStyles.labels}>
        <Text style={[indicatorStyles.label, currentStep === 1 && indicatorStyles.labelActive, currentStep === 2 && indicatorStyles.labelDone]}>
          {currentStep === 2 ? '1. PIN ✓' : '1. Enter PIN'}
        </Text>
        <Text style={[indicatorStyles.label, currentStep === 2 && indicatorStyles.labelActive]}>
          2. Verify Face
        </Text>
      </View>
    </View>
  );
}

const indicatorStyles = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ddd' },
  dotActive: { backgroundColor: '#1976d2' },
  dotDone: { backgroundColor: '#4caf50' },
  line: { flex: 1, height: 2, backgroundColor: '#ddd', marginHorizontal: 6 },
  lineDone: { backgroundColor: '#4caf50' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 },
  label: { fontSize: 11, color: '#999' },
  labelActive: { color: '#1976d2', fontWeight: 'bold' },
  labelDone: { color: '#4caf50' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16 },
  infoCard: { marginBottom: 16, backgroundColor: '#e3f2fd' },
  label: { color: '#666', marginBottom: 4 },
  enrollmentNo: { color: '#999', marginTop: 4 },
  emptyCard: { marginTop: 20, backgroundColor: '#fff9e6' },
  emptyContent: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { marginBottom: 12, textAlign: 'center', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#666', marginBottom: 20, lineHeight: 20 },
  refreshButton: { marginTop: 16 },
  formContainer: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16 },
  sectionTitle: { marginBottom: 16, fontWeight: 'bold' },
  sessionCard: { marginBottom: 16, backgroundColor: '#f0f7ff' },
  instructions: { color: '#666', marginBottom: 16, lineHeight: 20 },
  pinInput: { marginBottom: 16, fontSize: 24, letterSpacing: 8 },
  primaryButton: { paddingVertical: 8, marginBottom: 16 },
  disclaimer: { textAlign: 'center', color: '#999', lineHeight: 18 },
  successCard: { marginTop: 20, backgroundColor: '#e8f5e9' },
  successContent: { alignItems: 'center', paddingVertical: 40 },
  successIcon: { color: '#4caf50', marginBottom: 12 },
  successTitle: { marginBottom: 8, textAlign: 'center', fontWeight: 'bold', color: '#2e7d32' },
  successText: { textAlign: 'center', color: '#388e3c', marginBottom: 20, lineHeight: 20 },
  button: { marginTop: 16 },
  fullScreenContainer: { flex: 1, backgroundColor: '#0a0a0a' ,},
  faceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8 },
  faceHeaderTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  faceStepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, marginBottom: 4 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#555' },
  stepDotActive: { backgroundColor: '#1976d2' },
  stepDotDone: { backgroundColor: '#4caf50' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#555', marginHorizontal: 6 },
  stepLineDone: { backgroundColor: '#4caf50' },
  faceStepLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28, marginBottom: 8 },
  stepLabelDone: { fontSize: 11, color: '#4caf50' },
  stepLabelActive: { fontSize: 11, color: '#1976d2', fontWeight: 'bold' },
  cameraFlex: { flex: 1 },
  verifyingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  verifyingText: { color: '#fff', marginTop: 12, fontSize: 16 },
  faceErrorBar: { backgroundColor: '#1a0a0a', padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#c62828' },
  faceErrorText: { color: '#ef9a9a', textAlign: 'center', lineHeight: 20 },
});