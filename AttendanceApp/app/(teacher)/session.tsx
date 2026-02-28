import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList } from 'react-native';
import {
  Button,
  Text,
  ActivityIndicator,
  Snackbar,
  Card,
  Divider,
  Chip,
} from 'react-native-paper';
import * as Network from 'expo-network';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../store/sessionStore';
import { generatePIN, extractSubnet } from '../../lib/utils';
import { AttendanceSession, Student, AttendanceRecord } from '../../types';

export default function SessionScreen() {
  const { user } = useAuthStore();
  const { activeSession, setActiveSession } = useSessionStore();
  const teacherId = (user?.data as any)?.id;
  const teacher = user?.data as any;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [presentCount, setPresentCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [presentStudents, setPresentStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (activeSession) {
      fetchPresentStudents();
      // Subscribe to realtime updates
      const subscription = supabase
        .channel(`session-${activeSession.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'attendance_record',
            filter: `session_id=eq.${activeSession.id}`,
          },
          (payload) => {
            fetchPresentStudents();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [activeSession]);

  const fetchPresentStudents = async () => {
    if (!activeSession) return;

    try {
      const { data: records, error: recordError } = await supabase
        .from('attendance_record')
        .select('student_id, status')
        .eq('session_id', activeSession.id)
        .eq('status', 'present');

      if (recordError) throw recordError;

      const studentIds = records?.map((r) => r.student_id) || [];

      if (studentIds.length === 0) {
        setPresentStudents([]);
        setPresentCount(0);
        return;
      }

      const { data: students, error: studentError } = await supabase
        .from('student')
        .select('*')
        .in('id', studentIds);

      if (studentError) throw studentError;

      setPresentStudents(students || []);
      setPresentCount(students?.length || 0);
    } catch (err: any) {
      console.error('Error fetching present students:', err);
    }
  };

  const handleOpenSession = async () => {
    setLoading(true);
    setError('');

    try {
      // Get network info
      const ipAddress = await Network.getIpAddressAsync();
      const subnet = extractSubnet(ipAddress);
      const pin = generatePIN();

      // Create attendance session
      const { data: sessionData, error: sessionError } = await supabase
        .from('attendance_session')
        .insert([
          {
            teacher_id: teacherId,
            subject: teacher.subject,
            year: teacher.year,
            opened_at: new Date().toISOString(),
            router_subnet: subnet,
            session_pin: pin,
            is_active: true,
            date: new Date().toISOString().split('T')[0],
          },
        ])
        .select();

      if (sessionError) throw sessionError;

      if (sessionData && sessionData.length > 0) {
        const session = sessionData[0] as AttendanceSession;

        // Get all students for this year
        const { data: students, error: studentError } = await supabase
          .from('student')
          .select('*')
          .eq('year', teacher.year);

        if (studentError) throw studentError;

        // Create absent records for all students
        const absentRecords = (students || []).map((student) => ({
          session_id: session.id,
          student_id: student.id,
          status: 'absent' as const,
        }));

        if (absentRecords.length > 0) {
          const { error: insertError } = await supabase
            .from('attendance_record')
            .insert(absentRecords);

          if (insertError) throw insertError;
        }

        setStudentCount(students?.length || 0);
        setActiveSession(session);
        setSuccess(`Session opened! PIN: ${pin}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open session');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('attendance_session')
        .update({
          closed_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', activeSession.id);

      if (updateError) throw updateError;

      setActiveSession(null);
      setPresentStudents([]);
      setPresentCount(0);
      setSuccess('Session closed successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to close session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        {/* Teacher Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.label}>
              Subject & Year
            </Text>
            <Text variant="titleMedium">
              {teacher?.subject} • Year {teacher?.year}
            </Text>
            <Text variant="bodySmall" style={styles.dateText}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Session Controls */}
        <View style={styles.controlsContainer}>
          {!activeSession ? (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                No Active Session
              </Text>
              <Text style={styles.description}>
                Click below to open an attendance session. Students will see a 4-digit PIN to
                mark attendance.
              </Text>

              {loading ? (
                <ActivityIndicator size="large" style={styles.loader} />
              ) : (
                <Button
                  mode="contained"
                  onPress={handleOpenSession}
                  style={styles.primaryButton}
                >
                  🎯 Open Attendance Session
                </Button>
              )}
            </>
          ) : (
            <>
              {/* PIN Display */}
              <Card style={styles.pinCard}>
                <Card.Content style={styles.pinContent}>
                  <Text variant="labelSmall" style={styles.pinLabel}>
                    Current Session PIN
                  </Text>
                  <Text variant="displayMedium" style={styles.pinText}>
                    {activeSession.session_pin}
                  </Text>
                  <Text variant="bodySmall" style={styles.pinSubtext}>
                    Show this to students to mark attendance
                  </Text>
                </Card.Content>
              </Card>

              {/* Session Stats */}
              <Card style={styles.statsCard}>
                <Card.Content>
                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Text variant="labelSmall" style={styles.statLabel}>
                        Students Present
                      </Text>
                      <Text variant="headlineMedium" style={styles.statNumber}>
                        {presentCount}
                      </Text>
                    </View>
                    <View style={styles.stat}>
                      <Text variant="labelSmall" style={styles.statLabel}>
                        Total Students
                      </Text>
                      <Text variant="headlineMedium" style={styles.statNumber}>
                        {studentCount}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>

              {/* Close Button */}
              {loading ? (
                <ActivityIndicator size="large" style={styles.loader} />
              ) : (
                <Button
                  mode="contained"
                  buttonColor="#d32f2f"
                  onPress={handleCloseSession}
                  style={styles.dangerButton}
                >
                  ⏹ Close Session
                </Button>
              )}

              {/* Present Students List */}
              <Divider style={styles.divider} />

              <Text variant="titleMedium" style={styles.sectionTitle}>
                Students Marked Present ({presentCount})
              </Text>

              {presentStudents.length === 0 ? (
                <Text style={styles.emptyText}>
                  No students have marked attendance yet
                </Text>
              ) : (
                <View style={styles.studentsList}>
                  {presentStudents.map((student) => (
                    <Card key={student.id} style={styles.studentCard}>
                      <Card.Content style={styles.cardContent}>
                        <View style={styles.studentRow}>
                          <View>
                            <Text variant="titleSmall">{student.name}</Text>
                            <Text variant="bodySmall" style={styles.enrollmentNo}>
                              {student.enrollment_no}
                            </Text>
                          </View>
                          <Chip icon="check-circle" style={styles.presentChip}>
                            Present
                          </Chip>
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </>
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
  infoCard: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
  },
  label: {
    color: '#666',
    marginBottom: 4,
  },
  dateText: {
    color: '#999',
    marginTop: 8,
  },
  divider: {
    marginVertical: 16,
  },
  controlsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  description: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  loader: {
    marginVertical: 20,
  },
  primaryButton: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  dangerButton: {
    paddingVertical: 8,
    marginBottom: 16,
  },
  pinCard: {
    backgroundColor: '#fff3e0',
    marginBottom: 16,
  },
  pinContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pinLabel: {
    color: '#f57f17',
    marginBottom: 8,
  },
  pinText: {
    color: '#f57f17',
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  pinSubtext: {
    color: '#999',
    marginTop: 8,
  },
  statsCard: {
    marginBottom: 16,
    backgroundColor: '#f3e5f5',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    marginBottom: 8,
  },
  statNumber: {
    color: '#7b1fa2',
    fontWeight: 'bold',
  },
  studentsList: {
    gap: 8,
  },
  studentCard: {
    marginBottom: 8,
  },
  cardContent: {
    paddingVertical: 8,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  enrollmentNo: {
    color: '#999',
    marginTop: 4,
  },
  presentChip: {
    backgroundColor: '#4caf50',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
  },
});
