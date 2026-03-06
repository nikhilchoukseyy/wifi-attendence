import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Button,
  Text,
  ActivityIndicator,
  Snackbar,
  Card,
  SegmentedButtons,
  IconButton,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import { Student, AttendanceSession, AttendanceRecord } from '../../types';

export default function StudentsScreen() {
  const { user } = useAuthStore();
  const teacher = user?.data as any;
  const teacherId = teacher?.id;

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [selectedDate]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchStudentsAndRecords();
    }
  }, [selectedSessionId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];

      const { data, error: err } = await supabase
        .from('attendance_session')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('date', dateStr)
        .order('opened_at', { ascending: false });

      if (err) throw err;

      setSessions(data || []);
      if (data && data.length > 0) {
        setSelectedSessionId(data[0].id);
      } else {
        setStudents([]);
        setRecords({});
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsAndRecords = async () => {
    setLoading(true);
    try {
      // Get all students for teacher's year
      const { data: studentData, error: studentError } = await supabase
        .from('student')
        .select('*')
        .eq('year', teacher.year)
        .order('name');

      if (studentError) throw studentError;

      setStudents(studentData || []);

      // Get attendance records for this session
      const { data: recordData, error: recordError } = await supabase
        .from('attendance_record')
        .select('*')
        .eq('session_id', selectedSessionId);

      if (recordError) throw recordError;

      const recordMap: Record<string, AttendanceRecord> = {};
      recordData?.forEach((record) => {
        recordMap[record.student_id] = record;
      });

      setRecords(recordMap);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch students and records');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAttendance = async (studentId: string, currentStatus: 'present' | 'absent') => {
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';

    try {
      const { error: err } = await supabase
        .from('attendance_record')
        .upsert(
          {
            session_id: selectedSessionId,
            student_id: studentId,
            status: newStatus,
            is_manual_edit: true,
            marked_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,student_id' }
        );

      if (err) throw err;

      setRecords({
        ...records,
        [studentId]: {
          ...records[studentId],
          status: newStatus,
          is_manual_edit: true,
        } as AttendanceRecord,
      });

      setSuccess('Attendance updated');
    } catch (err: any) {
      setError(err.message || 'Failed to update attendance');
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  if (loading && students.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        {/* Date Picker */}
        <Button
          mode="outlined"
          onPress={() => setShowDatePicker(true)}
          style={styles.dateButton}
        >
          📅 {formatDate(selectedDate.toISOString().split('T')[0])}
        </Button>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* Session Picker */}
        {sessions.length > 0 ? (
          <>
            <Text variant="labelSmall" style={styles.label} >
              Select Session
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedSessionId}
                onValueChange={setSelectedSessionId}
              >
                {sessions.map((session) => (
                  <Picker.Item
                    key={session.id}
                    style={styles.pickerOptions}
                    label={`${session.subject} - ${new Date(session.opened_at).toLocaleTimeString()}`}
                    value={session.id}
                  />
                ))}
              </Picker>
            </View>
          </>
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>
                No sessions found for {formatDate(selectedDate.toISOString().split('T')[0])}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Students List */}
        {selectedSessionId && students.length > 0 && (
          <>
            <Text variant="titleSmall" style={styles.studentListTitle}>
              Mark Attendance ({students.length} students)
            </Text>

            <View style={styles.studentsList}>
              {students.map((student) => {
                const record = records[student.id];
                const status = record?.status || 'absent';

                return (
                  <Card key={student.id} style={styles.studentCard}>
                    <Card.Content style={styles.cardContent}>
                      <View style={styles.studentInfo}>
                        <View style={styles.nameContainer}>
                          <Text variant="titleSmall">{student.name}</Text>
                          <Text variant="bodySmall" style={styles.enrollment}>
                            {student.enrollment_no}
                          </Text>
                        </View>

                        <View style={styles.statusButtons}>
                          <IconButton
                            icon={status === 'present' ? 'check-circle' : 'circle-outline'}
                            iconColor={status === 'present' ? '#4caf50' : '#999'}
                            size={24}
                            onPress={() =>
                              handleToggleAttendance(
                                student.id,
                                status as 'present' | 'absent'
                              )
                            }
                          />
                          <IconButton
                            icon={status === 'absent' ? 'close-circle' : 'circle-outline'}
                            iconColor={status === 'absent' ? '#f44336' : '#999'}
                            size={24}
                            onPress={() =>
                              handleToggleAttendance(
                                student.id,
                                status as 'present' | 'absent'
                              )
                            }
                          />
                        </View>
                      </View>

                      {record?.is_manual_edit && (
                        <Text variant="labelSmall" style={styles.editedLabel}>
                          Manual edit
                        </Text>
                      )}
                    </Card.Content>
                  </Card>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Snackbar visible={!!error} onDismiss={() => setError('')} duration={4000}>
        {error}
      </Snackbar>
      <Snackbar visible={!!success} onDismiss={() => setSuccess('')} duration={2000}>
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
  dateButton: {
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 16,
  },
  pickerOptions: {
    color: '#333',
  },
  emptyCard: {
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
  },
  studentListTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  studentsList: {
    gap: 8,
    marginBottom: 20,
  },
  studentCard: {
    marginBottom: 4,
  },
  cardContent: {
    paddingVertical: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameContainer: {
    flex: 1,
  },
  enrollment: {
    color: '#999',
    marginTop: 4,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  editedLabel: {
    color: '#f57c00',
    marginTop: 8,
  },
  loader: {
    marginVertical: 40,
  },
  sessionText:{
    color:'#f71b1b',
  }
});
