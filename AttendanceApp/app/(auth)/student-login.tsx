import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  ActivityIndicator,
  Snackbar,
  Card,
  Chip,
} from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Student } from '../../types';
import * as Device from 'expo-device';
import {
  getFaceEmbedding,
  isSamePerson,
  storeFaceEmbedding,
  loadFaceEmbedding,
} from '../../lib/faceAuth';

export default function StudentLogin() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [name, setName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Face registration flow
  const [step, setStep] = useState<'form' | 'face-capture' | 'face-match'>('form');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);

  // ─── Helper: get device ID ────────────────────────────────────────────────
  const getDeviceId = (): string => {
    return Device.osBuildId ?? Device.modelId ?? 'unknown';
  };

  // ─── Helper: finalize login after all checks pass ─────────────────────────
  // Called at the end of both first-time and returning student flows
  const finalizeLogin = async (studentId: string) => {
    const { data: updatedStudent } = await supabase
      .from('student')
      .select('*')
      .eq('id', studentId)
      .single();

    if (updatedStudent) {
      setUser({ role: 'student', data: updatedStudent as Student });
    }

    router.replace('/(student)/mark-attendance');
  };

  // ─── STEP 1: Handle Login Form Submit ─────────────────────────────────────
  const handleLogin = async () => {
    if (!name || !enrollmentNo || !mobileNo) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Find student by enrollment + mobile
      const { data: students, error: queryError } = await supabase
        .from('student')
        .select('*')
        .eq('enrollment_no', enrollmentNo)
        .eq('mobile_no', mobileNo);

      if (queryError) throw queryError;

      if (!students || students.length === 0) {
        throw new Error('Student not found. Please verify your details.');
      }

      const student = students[0] as Student;

      // Verify name matches
      if (student.name.toLowerCase() !== name.toLowerCase()) {
        throw new Error('Name does not match enrollment records');
      }

      const deviceId = getDeviceId();

      // Check if this device is bound to a DIFFERENT student
      const { data: deviceUsers } = await supabase
        .from('student')
        .select('id, name')
        .eq('device_id', deviceId)
        .eq('is_device_bound', true);

      if (deviceUsers && deviceUsers.length > 0) {
        const boundStudentId = deviceUsers[0].id;
        if (boundStudentId !== student.id) {
          throw new Error(
            'This device is already linked to another student account. Please use a different device.'
          );
        }
      }

      // Check if THIS student is bound to a different device
      if (student.is_device_bound && student.device_id !== deviceId) {
        throw new Error(
          'This account is already linked to another device. Contact your HOD.'
        );
      }

      // ── First time login: face not registered yet ──
      if (!student.face_registered) {
        // HOD must upload reference photo first
        if (!student.face_image_url) {
          throw new Error(
            '❌ HOD has not uploaded your reference photo yet. Contact your HOD.'
          );
        }
        // Go to face capture step
        setCurrentStudent(student);
        setStep('face-capture');
        setLoading(false);
        return;
      }

      // ── Returning student: face already registered ──
      // Ensure embedding is cached locally (in case app was reinstalled)
      const existingEmbedding = await loadFaceEmbedding(student.id);
      if (!existingEmbedding && student.face_embedding) {
        // ✅ Restore embedding from Supabase to local cache
        await storeFaceEmbedding(student.id, student.face_embedding);
      }

      // Bind device if not already bound
      if (!student.is_device_bound) {
        const { error: bindError } = await supabase
          .from('student')
          .update({ device_id: deviceId, is_device_bound: true })
          .eq('id', student.id);

        if (bindError) throw bindError;
      }

      await finalizeLogin(student.id);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 2: Capture Face Photo ───────────────────────────────────────────
  const handleCaptureFace = async () => {
    try {
      if (!cameraRef) return;

      if (!permission?.granted) {
        await requestPermission();
        return;
      }

      const photo = await cameraRef.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      setCapturedPhotoUri(photo.uri);
      setStep('face-match');
    } catch (err: any) {
      setError('Failed to capture photo: ' + err.message);
    }
  };

  // ─── STEP 3: Match Captured Face With Reference Photo ────────────────────
  const handleFaceMatch = async () => {
    if (!currentStudent || !capturedPhotoUri) {
      setError('Missing face data');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // ✅ FIX: face_image_url might be a full URL or just a file path
      // We handle both cases here
      let referenceImageUrl = currentStudent.face_image_url!;

      // If it's NOT a full URL, generate a signed URL from storage path
      if (!referenceImageUrl.startsWith('http')) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('face-photos')
          .createSignedUrl(referenceImageUrl, 60);

        if (signedError || !signedData?.signedUrl) {
          throw new Error('Could not load reference photo. Contact your HOD.');
        }
        referenceImageUrl = signedData.signedUrl;
      }

      // Extract face features from HOD's reference photo
      const referenceEmbedding = await getFaceEmbedding(referenceImageUrl);

      // Extract face features from student's live photo
      const liveEmbedding = await getFaceEmbedding(capturedPhotoUri);

      // Compare — 85% similarity required
      const matched = isSamePerson(referenceEmbedding, liveEmbedding, 0.85);

      if (!matched) {
        throw new Error('❌ Your face does not match the reference photo. Try again in good lighting.');
      }

      // ✅ FIX: Save embedding to BOTH AsyncStorage AND Supabase
      // AsyncStorage = fast local access
      // Supabase = survives app reinstall
      await storeFaceEmbedding(currentStudent.id, liveEmbedding);

      // ✅ FIX: Update face_registered AND face_embedding in one single DB call
      const { error: updateError } = await supabase
        .from('student')
        .update({
          face_registered: true,
          face_embedding: liveEmbedding, // saved to DB for future reinstalls
        })
        .eq('id', currentStudent.id);

      if (updateError) throw updateError;

      // Bind device
      const deviceId = getDeviceId();
      const { error: bindError } = await supabase
        .from('student')
        .update({ device_id: deviceId, is_device_bound: true })
        .eq('id', currentStudent.id);

      if (bindError) throw bindError;

      await finalizeLogin(currentStudent.id);
    } catch (err: any) {
      setError(err.message || 'Face verification failed');
      // Reset so student can try again
      setCapturedPhotoUri(null);
      setStep('face-capture');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFace = () => {
    setCapturedPhotoUri(null);
    setStep('face-capture');
    setError('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: STEP 1 — Login Form
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'form') {
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
            <Button mode="contained" onPress={handleLogin} style={styles.button}>
              Login
            </Button>
          )}

          <Button mode="text" onPress={() => router.back()} style={styles.backButton}>
            Back
          </Button>
        </View>

        <Snackbar visible={!!error} onDismiss={() => setError('')} duration={4000}>
          {error}
        </Snackbar>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: STEP 2 — Camera Face Capture
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'face-capture') {
    if (!permission?.granted) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ marginBottom: 16 }}>Camera permission needed</Text>
          <Button onPress={requestPermission} mode="contained">
            Grant Camera Permission
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <View style={styles.cameraHeader}>
          <Text variant="headlineSmall" style={styles.cameraTitle}>
            Face Registration
          </Text>
          <Text style={styles.cameraSubtitle}>
            Look directly at the camera in good lighting
          </Text>
        </View>

        <CameraView ref={setCameraRef} style={styles.camera} facing="front" />

        <View style={styles.cameraFooter}>
          <Button
            mode="contained"
            onPress={handleCaptureFace}
            disabled={loading}
            icon="camera"
            style={styles.captureButton}
          >
            📸 Capture Face Photo
          </Button>
          <Button
            mode="text"
            onPress={() => {
              setStep('form');
              setCurrentStudent(null);
              setError('');
            }}
            disabled={loading}
            textColor="#fff"
          >
            Back
          </Button>
        </View>

        <Snackbar visible={!!error} onDismiss={() => setError('')} duration={4000}>
          {error}
        </Snackbar>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: STEP 3 — Face Matching
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'face-match') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.title}>
              Face Verification
            </Text>
            <Text style={styles.subtitle}>
              Comparing your face with your reference photo...
            </Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1e40af" />
                <Text style={styles.loadingText}>Processing face recognition...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Chip icon="alert-circle" style={styles.errorChip}>
                  Face Match Failed
                </Chip>
                <Text style={styles.errorMessage}>{error}</Text>
                <Button mode="contained" onPress={handleRetryFace} style={styles.button}>
                  Try Again
                </Button>
              </View>
            ) : (
              <View style={styles.actionContainer}>
                <Button
                  mode="contained"
                  onPress={handleFaceMatch}
                  disabled={loading}
                  style={styles.button}
                >
                  Verify Face
                </Button>
                <Button
                  mode="outlined"
                  onPress={handleRetryFace}
                  disabled={loading}
                  style={styles.button}
                >
                  Retake Photo
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>

        <Snackbar visible={!!error} onDismiss={() => setError('')} duration={4000}>
          {error}
        </Snackbar>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    justifyContent: 'center',
    minHeight: '100%',
    paddingHorizontal: 20,
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
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginTop: 8,
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    backgroundColor: '#1a1a1a',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  cameraTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraSubtitle: {
    color: '#ccc',
    fontSize: 13,
    marginTop: 4,
  },
  camera: {
    flex: 1,
  },
  cameraFooter: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  captureButton: {
    paddingVertical: 8,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 20,
    elevation: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    paddingVertical: 20,
  },
  errorChip: {
    marginBottom: 12,
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  errorMessage: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  actionContainer: {
    gap: 12,
  },
});