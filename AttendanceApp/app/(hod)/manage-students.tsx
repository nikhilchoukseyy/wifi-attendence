import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  TextInput,
  Button,
  Text,
  ActivityIndicator,
  Snackbar,
  Card,
  IconButton,
  Divider,
  Chip,
} from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Student } from '../../types';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export default function ManageStudentsScreen() {
  const { user } = useAuthStore();
  const hodId = (user?.data as any)?.id;

  const [name, setName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [year, setYear] = useState<1 | 2 | 3 | 4>(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('student')
        .select('*')
        .eq('hod_id', hodId)
        .order('year')
        .order('name');

      if (err) throw err;
      setStudents(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!name || !enrollmentNo || !mobileNo) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('student')
        .insert([
          {
            hod_id: hodId,
            name,
            enrollment_no: enrollmentNo,
            mobile_no: mobileNo,
            year,
            is_device_bound: false,
            device_id: null,
            // NEW fields — default values on insert
            face_image_url: null,
            face_registered: false,
          },
        ])
        .select();

      if (err) throw err;

      const newStudent = data[0];
      setStudents([...students, newStudent]);
      setName('');
      setEnrollmentNo('');
      setMobileNo('');
      setYear(1);
      setLoading(false);

      // Ask HOD to upload face photo immediately
      Alert.alert(
        'Student Added ✓',
        `${newStudent.name} has been added. Upload their face photo now?`,
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => {
              setSuccess(`${newStudent.name} added successfully`);
            },
          },
          {
            text: 'Upload Now',
            onPress: () => uploadFacePhoto(newStudent.id),
          },
        ]
      );
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to add student');
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    Alert.alert(
      'Delete Student',
      'Are you sure? This will also delete all attendance records for this student.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error: err } = await supabase
                .from('student')
                .delete()
                .eq('id', studentId);

              if (err) throw err;

              setStudents(students.filter((s) => s.id !== studentId));
              setSuccess('Student deleted successfully');
            } catch (err: any) {
              setError(err.message || 'Failed to delete student');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ─── FACE PHOTO UPLOAD ───────────────────────────────────────────────────────
  // Kyun: HOD ki uploaded photo hi attendance ke time face match ke liye use hogi.
  // Bina photo ke student ka face match nahi ho sakta — attendance blocked rahega.
  const uploadFacePhoto = async (studentId: string) => {
    try {
      setUploadingPhotoFor(studentId);

      // Gallery permission lo
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow access to photo library.');
        return;
      }

      // HOD photo choose kare — square crop forced (face ke liye best)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled) return;

      // 800x800 pe resize + 80% quality compress
      // Kyun: Original photo 3-5MB hoti hai — compress ke baad ~100KB — fast upload
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800, height: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Read compressed image as base64 (React Native compatible)
      const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array (React Native doesn't have Buffer)
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Supabase Storage mein upload karo
      // Path: "{studentId}/reference.jpg" — har student ka alag folder
      const path = `${studentId}/reference.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('face-photos')
        .upload(path, bytes, {
          upsert: true,           // pehle se hai toh overwrite
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      // 1 saal ka signed URL banao
      // Kyun: Bucket private hai — direct URL kaam nahi karega
      const { data: urlData } = await supabase.storage
        .from('face-photos')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (!urlData?.signedUrl) throw new Error('Failed to generate photo URL');

      // Student record mein URL save karo
      const { error: updateError } = await supabase
        .from('student')
        .update({ face_image_url: urlData.signedUrl })
        .eq('id', studentId);

      if (updateError) throw updateError;

      // Local state update — list refresh ke bina badge turant green ho jaayega
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, face_image_url: urlData.signedUrl }
            : s
        )
      );

      setSuccess('Face photo uploaded successfully!');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Photo upload failed. Try again.');
    } finally {
      setUploadingPhotoFor(null);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const groupedStudents = students.reduce(
    (acc, student) => {
      const yearKey = `year${student.year}`;
      if (!acc[yearKey]) acc[yearKey] = [];
      acc[yearKey].push(student);
      return acc;
    },
    {} as Record<string, Student[]>
  );

  // Count: kitne students ki photo upload hui hai
  const withPhoto = students.filter((s) => s.face_image_url).length;
  const withoutPhoto = students.length - withPhoto;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>

        {/* ── FORM: Add New Student ── */}
        <View style={styles.formContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Add New Student
          </Text>

          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            disabled={loading}
          />
          <TextInput
            label="Enrollment Number"
            value={enrollmentNo}
            onChangeText={setEnrollmentNo}
            style={styles.input}
            disabled={loading}
          />
          <TextInput
            label="Mobile Number"
            value={mobileNo}
            onChangeText={setMobileNo}
            keyboardType="phone-pad"
            style={styles.input}
            disabled={loading}
          />

          <Text style={styles.label}>Year</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={year}
              onValueChange={(value) => setYear(value)}
              enabled={!loading}
            >
              <Picker.Item label="Year 1" value={1} />
              <Picker.Item label="Year 2" value={2} />
              <Picker.Item label="Year 3" value={3} />
              <Picker.Item label="Year 4" value={4} />
            </Picker>
          </View>

          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : (
            <Button mode="contained" onPress={handleAddStudent} style={styles.button}>
              Add Student
            </Button>
          )}
        </View>

        <Divider style={styles.divider} />

        {/* ── PHOTO SUMMARY BANNER ── */}
        {/* Kyun: HOD ko ek nazar mein dikhna chahiye ki kitne students ki photo pending hai */}
        {students.length > 0 && (
          <View style={styles.photoBanner}>
            <View style={styles.photoStat}>
              <Text style={styles.photoStatNum}>{withPhoto}</Text>
              <Text style={styles.photoStatLabelGreen}>Photos ✓</Text>
            </View>
            <View style={styles.photoStatDivider} />
            <View style={styles.photoStat}>
              <Text style={styles.photoStatNum}>{withoutPhoto}</Text>
              <Text style={styles.photoStatLabelRed}>Photos Missing ✗</Text>
            </View>
            {withoutPhoto > 0 && (
              <Text style={styles.photoWarning}>
                ⚠️ Students without photo cannot use face attendance
              </Text>
            )}
          </View>
        )}

        {/* ── STUDENT LIST ── */}
        <View style={styles.listContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            All Students ({students.length})
          </Text>

          {students.length === 0 ? (
            <Text style={styles.emptyText}>No students added yet</Text>
          ) : (
            [1, 2, 3, 4].map((y) => {
              const yearStudents = groupedStudents[`year${y}`];
              if (!yearStudents || yearStudents.length === 0) return null;

              return (
                <View key={`year${y}`} style={styles.yearGroup}>
                  <Text variant="labelLarge" style={styles.yearTitle}>
                    Year {y} ({yearStudents.length})
                  </Text>

                  {yearStudents.map((student) => (
                    <Card key={student.id} style={styles.studentCard}>
                      <Card.Content>

                        {/* ── Row 1: Name + Delete button ── */}
                        <View style={styles.cardHeader}>
                          <View style={styles.cardInfo}>
                            <Text variant="titleSmall">{student.name}</Text>
                            <Text variant="bodySmall" style={styles.subtitle}>
                              {student.enrollment_no}
                            </Text>
                            <Text variant="bodySmall" style={styles.subtitle}>
                              {student.mobile_no}
                            </Text>
                          </View>
                          <IconButton
                            icon="delete"
                            iconColor="red"
                            size={20}
                            onPress={() => handleDeleteStudent(student.id)}
                            disabled={loading || uploadingPhotoFor === student.id}
                          />
                        </View>

                        {/* ── Row 2: Photo Status Badge ── */}
                        {/* Kyun: Green badge = face match ready, Red = student ka attendance block hoga */}
                        <View style={styles.badgeRow}>
                          {student.face_image_url ? (
                            <Chip
                              icon="check-circle"
                              style={styles.chipGreen}
                              textStyle={styles.chipTextGreen}
                              compact
                            >
                              Photo Uploaded ✓
                            </Chip>
                          ) : (
                            <Chip
                              icon="alert-circle"
                              style={styles.chipRed}
                              textStyle={styles.chipTextRed}
                              compact
                            >
                              No Photo ✗
                            </Chip>
                          )}
                        </View>

                        {/* ── Row 3: Upload Button ── */}
                        {/* Kyun: HOD yahan se directly photo upload kar sakta hai — alag screen nahi chahiye */}
                        <Button
                          mode={student.face_image_url ? 'outlined' : 'contained'}
                          onPress={() => uploadFacePhoto(student.id)}
                          loading={uploadingPhotoFor === student.id}
                          disabled={uploadingPhotoFor !== null} // sirf ek upload ek time pe
                          icon={student.face_image_url ? 'camera-retake' : 'camera-plus'}
                          style={[
                            styles.uploadButton,
                            !student.face_image_url && styles.uploadButtonRequired,
                          ]}
                          compact
                        >
                          {uploadingPhotoFor === student.id
                            ? 'Uploading...'
                            : student.face_image_url
                            ? 'Re-upload Photo'
                            : 'Upload Face Photo'}
                        </Button>

                      </Card.Content>
                    </Card>
                  ))}
                </View>
              );
            })
          )}
        </View>
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

  // ── Form ──
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 12,
  },
  button: {
    marginTop: 12,
    paddingVertical: 6,
  },
  loader: {
    marginVertical: 20,
  },
  divider: {
    marginVertical: 16,
  },

  // ── Photo Summary Banner ──
  photoBanner: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  photoStat: {
    alignItems: 'center',
    minWidth: 70,
  },
  photoStatNum: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1a1a1a',
  },
  photoStatLabelGreen: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '700',
  },
  photoStatLabelRed: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '700',
  },
  photoStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#e0e0e0',
  },
  photoWarning: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
    flex: 1,
    minWidth: 200,
  },

  // ── Student List ──
  listContainer: {
    marginBottom: 20,
  },
  yearGroup: {
    marginBottom: 16,
  },
  yearTitle: {
    color: '#666',
    marginBottom: 8,
  },
  studentCard: {
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
  },
  subtitle: {
    color: '#999',
    marginTop: 2,
  },

  // ── Photo Badge ──
  badgeRow: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
  },
  chipGreen: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  chipTextGreen: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700',
  },
  chipRed: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  chipTextRed: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Upload Button ──
  uploadButton: {
    marginTop: 4,
  },
  uploadButtonRequired: {
    backgroundColor: '#1e40af', // blue — photo nahi hai toh prominent dikhao
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
  },
});