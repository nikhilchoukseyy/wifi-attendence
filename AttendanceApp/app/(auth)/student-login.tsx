import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  ActivityIndicator,
  Snackbar,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import FaceCamera from '../../components/FaceCamera';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { verifyFaceWithBackend } from '../../lib/faceApi';
import { Student } from '../../types';

export default function StudentLogin() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [name, setName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'form' | 'face'>('form');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  const getDeviceId = (): string => {
    return Device.osBuildId ?? Device.modelId ?? 'unknown';
  };

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

  // ✅ FIXED: Hamesha fresh signed URL generate karo
  // Stored URL expire ho jaata hai — Face++ usse fetch nahi kar paata
  const getFreshSignedUrl = async (studentId: string): Promise<string> => {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('face-photos')
      .createSignedUrl(`${studentId}/reference.jpg`, 600); // 10 min valid

    if (signedError || !signedData?.signedUrl) {
      throw new Error('Could not load reference photo. Contact your HOD.');
    }

    return signedData.signedUrl;
  };

  const handleLogin = async () => {
    if (!name || !enrollmentNo || !mobileNo) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Step 1: Student fetch karo DB se
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

      // Step 2: Name match karo
      if (student.name.toLowerCase() !== name.toLowerCase()) {
        throw new Error('Name does not match enrollment records.');
      }

      // Step 3: Device binding check
      const deviceId = getDeviceId();

      // Koi aur student already is device se bound toh nahi?
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

      // Yeh student kisi aur device se bound toh nahi?
      if (student.is_device_bound && student.device_id !== deviceId) {
        throw new Error(
          'This account is already linked to another device. Contact your HOD.'
        );
      }

      // Step 4: Face registered nahi → face registration flow
      if (!student.face_registered) {
        if (!student.face_image_url) {
          throw new Error('HOD has not uploaded your reference photo yet. Contact your HOD.');
        }
        // Face camera open karo
        setCurrentStudent(student);
        setStep('face');
        return;
      }

      // Already registered → device bind karo agar nahi hua
      if (!student.is_device_bound) {
        const { error: bindError } = await supabase
          .from('student')
          .update({ device_id: deviceId, is_device_bound: true })
          .eq('id', student.id);

        if (bindError) throw bindError;
      }

      // Login complete
      await finalizeLogin(student.id);

    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Face registration — first time only
  // Face++ se compare: HOD reference photo vs student live photo
  const handleFaceVerified = async (capturedPhotoUri: string) => {
    if (!currentStudent) {
      setError('Missing student data. Please go back and try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fresh signed URL lo — stored URL expire ho sakta hai
      const referenceImageUrl = await getFreshSignedUrl(currentStudent.id);

      // Face++ API se compare karo
      // confidence >= 70 → same person → true
      const matched = await verifyFaceWithBackend(capturedPhotoUri, referenceImageUrl);

      if (!matched) {
        throw new Error(
          'Your face does not match the reference photo. Try again in good lighting.'
        );
      }

      // Match hua → device bind karo + face_registered = true
      const deviceId = getDeviceId();
      const { error: updateError } = await supabase
        .from('student')
        .update({
          face_registered: true,
          device_id: deviceId,
          is_device_bound: true,
        })
        .eq('id', currentStudent.id);

      if (updateError) throw updateError;

      // Login complete
      await finalizeLogin(currentStudent.id);

    } catch (err: any) {
      setError(err.message || 'Face verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Form Screen ──────────────────────────────────────────

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
            autoCapitalize="characters"
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

  // ─── Face Registration Screen ─────────────────────────────

  return (
    <View style={styles.cameraContainer}>
      <View style={styles.cameraHeader}>
        <Text variant="headlineSmall" style={styles.cameraTitle}>
          📸 Face Registration
        </Text>
        <Text style={styles.cameraSubtitle}>
          First time setup — your face will be matched with your HOD's reference photo.
        </Text>
      </View>

      <View style={styles.cameraBody}>
        <FaceCamera
          instruction="Look directly at the camera in good lighting, then tap capture"
          onCapture={handleFaceVerified}
          onError={(msg) => {
            setError(msg);
            setLoading(false);
          }}
        />
      </View>

      <View style={styles.cameraFooter}>
        <Button
          mode="text"
          onPress={() => {
            setStep('form');
            setCurrentStudent(null);
            setError('');
            setLoading(false);
          }}
          disabled={loading}
          textColor="#fff"
        >
          ← Back
        </Button>
      </View>

      {/* Verifying overlay */}
      {loading && (
        <View style={styles.verifyingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.verifyingText}>Verifying your face...</Text>
        </View>
      )}

      <Snackbar visible={!!error} onDismiss={() => setError('')} duration={5000}>
        {error}
      </Snackbar>
    </View>
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
    lineHeight: 18,
  },
  cameraBody: {
    flex: 1,
  },
  cameraFooter: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  verifyingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 15,
  },
});