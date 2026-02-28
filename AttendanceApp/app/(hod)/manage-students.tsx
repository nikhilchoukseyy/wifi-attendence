import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Snackbar, Card, IconButton, Divider } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Student } from '../../types';

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
          },
        ])
        .select();

      if (err) throw err;

      setStudents([...students, data[0]]);
      setName('');
      setEnrollmentNo('');
      setMobileNo('');
      setYear(1);
      setSuccess('Student added successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
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
  };

  const groupedStudents = students.reduce(
    (acc, student) => {
      const yearKey = `year${student.year}`;
      if (!acc[yearKey]) {
        acc[yearKey] = [];
      }
      acc[yearKey].push(student);
      return acc;
    },
    {} as Record<string, Student[]>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Add New Student
          </Text>

          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter student name"
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Enrollment Number"
            value={enrollmentNo}
            onChangeText={setEnrollmentNo}
            placeholder="e.g., 2021001"
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Mobile Number"
            value={mobileNo}
            onChangeText={setMobileNo}
            placeholder="e.g., 9876543210"
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
                      <Card.Content style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                          <View>
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
                            disabled={loading}
                          />
                        </View>
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
    marginBottom: 8,
  },
  cardContent: {
    paddingVertical: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
  },
});
