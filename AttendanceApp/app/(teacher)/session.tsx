import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Button, Text, ActivityIndicator, Snackbar,
  Card, Divider, Chip,
} from 'react-native-paper';
import * as Network from 'expo-network';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { useSessionStore } from '../../store/sessionStore';
import { generatePIN, extractSubnet, getWifiInfo } from '../../lib/utils';
import { AttendanceSession, Student } from '../../types';
import { syncPendingRecords, getPendingCount } from '../../lib/offlineSync';

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
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── CHANGE 1: Pending count polling ──────────────────────────────────────
  // Pehle yeh nahi tha. Kyun chahiye: teacher ko pata chale ki kitne
  // students ke records abhi AsyncStorage mein hain — sync nahi hue.
  // Har 5 second pe refresh hota hai jab session active ho.
  useEffect(() => {
    if (!activeSession) return;
    getPendingCount().then(setPendingCount);
    const interval = setInterval(() => {
      getPendingCount().then(setPendingCount);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeSession]);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeSession) {
      fetchPresentStudents();
      const subscription = supabase
        .channel(`session-${activeSession.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_record',
          filter: `session_id=eq.${activeSession.id}`,
        }, () => { fetchPresentStudents(); })
        .subscribe();
      return () => { subscription.unsubscribe(); };
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
        .from('student').select('*').in('id', studentIds);
      if (studentError) throw studentError;
      setPresentStudents(students || []);
      setPresentCount(students?.length || 0);
    } catch (err: any) {
      console.error('Error fetching present students:', err);
    }
  };

  // handleOpenSession — already had bssid + expires_at, unchanged
  const handleOpenSession = async () => {
    setLoading(true);
    setError('');
    try {
      const { subnet, bssid } = await getWifiInfo();
      const pin = generatePIN();
      
      await supabase
        .from('attendance_session')
        .update({ is_active: false })
        .eq('teacher_id', teacher.id)
        .eq('is_active', true);

      const { data: sessionData, error: sessionError } = await supabase
        .from('attendance_session')
        .insert([{
          teacher_id: teacherId,
          subject: teacher.subject,
          year: teacher.year,
          opened_at: new Date().toISOString(),
          router_subnet: subnet,
          session_pin: pin,
          is_active: true,
          date: new Date().toISOString().split('T')[0],
          session_bssid: bssid,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }])
        .select();

      if (sessionError) throw sessionError;

      if (sessionData && sessionData.length > 0) {
        const session = sessionData[0] as AttendanceSession;

        const { data: students, error: studentError } = await supabase
          .from('student').select('*').eq('year', teacher.year);
        if (studentError) throw studentError;

        const absentRecords = (students || []).map((student) => ({
          session_id: session.id,
          student_id: student.id,
          status: 'absent' as const,
        }));

        if (absentRecords.length > 0) {
          const { error: insertError } = await supabase
            .from('attendance_record').insert(absentRecords);
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

  // ── CHANGE 2: handleCloseSession — sync before close ─────────────────────
  // Pehle wala directly close kar deta tha.
  // Problem: Weak WiFi students ke records AsyncStorage mein pending the.
  // Close hone ke baad wo records FOREVER lost ho jaate — koi sync nahi hota.
  // Fix: Pending check karo, confirm lo, phir sync karo, phir close karo.
  const handleCloseSession = async () => {
    if (!activeSession) return;
    const currentPending = await getPendingCount();
    if (currentPending > 0) {
      Alert.alert(
        'Pending Records Found',
        `${currentPending} student record(s) are saved offline and not yet synced to the server. Sync them before closing?`,
        [
          { text: 'Sync & Close', onPress: () => performClose(true) },
          {
            text: 'Close Anyway',
            style: 'destructive',
            onPress: () => performClose(false),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      performClose(false);
    }
  };

  const performClose = async (doSync: boolean) => {
    setLoading(true);
    setError('');
    try {
      if (doSync) {
        setIsSyncing(true);
        await syncPendingRecords();
        setIsSyncing(false);
        setPendingCount(0);
      }

      const { error: updateError } = await supabase
        .from('attendance_session')
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq('id', activeSession!.id);
      if (updateError) throw updateError;

      setActiveSession(null);
      setPresentStudents([]);
      setPresentCount(0);
      setSuccess('Session closed successfully');
    } catch (err: any) {
      setIsSyncing(false);
      setError(err.message || 'Failed to close session');
    } finally {
      setLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>

        {/* Teacher Info — unchanged */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="labelSmall" style={styles.label}>Subject & Year</Text>
            <Text variant="titleMedium">
              {teacher?.subject} • Year {teacher?.year}
            </Text>
            <Text variant="bodySmall" style={styles.dateText}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric',
                month: 'long', day: 'numeric',
              })}
            </Text>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        <View style={styles.controlsContainer}>
          {!activeSession ? (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                No Active Session
              </Text>
              <Text style={styles.description}>
                Click below to open an attendance session. Students will see a
                4-digit PIN to mark attendance.
              </Text>
              {loading ? (
                <ActivityIndicator size="large" style={styles.loader} />
              ) : (
                <Button
                  mode="contained"
                  onPress={handleOpenSession}
                  style={styles.primaryButton}
                >
                  Open Attendance Session
                </Button>
              )}
            </>
          ) : (
            <>
              {/* PIN Display — unchanged */}
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

              {/* Stats — unchanged */}
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

              {/* ── CHANGE 3: Pending sync warning banner ── */}
              {/* Dikhta hai tabhi jab koi record pending ho */}
              {pendingCount > 0 && (
                <Card style={styles.pendingCard}>
                  <Card.Content style={styles.pendingContent}>
                    <Text style={styles.pendingIcon}>⚠️</Text>
                    <View style={styles.pendingTextWrap}>
                      <Text style={styles.pendingTitle}>
                        {pendingCount} record{pendingCount > 1 ? 's' : ''} pending sync
                      </Text>
                      <Text style={styles.pendingSubtitle}>
                        Syncs automatically, or tap Close to force sync
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              )}

              {/* Close button — syncing state alag dikhta hai */}
              {isSyncing ? (
                <View style={styles.syncingBox}>
                  <ActivityIndicator size="small" color="#1976d2" />
                  <Text style={styles.syncingText}>
                    Syncing offline records... please wait
                  </Text>
                </View>
              ) : loading ? (
                <ActivityIndicator size="large" style={styles.loader} />
              ) : (
                <Button
                  mode="contained"
                  buttonColor="#d32f2f"
                  onPress={handleCloseSession}
                  style={styles.dangerButton}
                  disabled={isSyncing}
                >
                  {pendingCount > 0
                    ? `Close Session (${pendingCount} pending)`
                    : 'Close Session'}
                </Button>
              )}

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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 16 },
  infoCard: { marginBottom: 16, backgroundColor: '#e3f2fd' },
  label: { color: '#666', marginBottom: 4 },
  dateText: { color: '#999', marginTop: 8 },
  divider: { marginVertical: 16 },
  controlsContainer: { marginBottom: 20 },
  sectionTitle: { marginBottom: 8, fontWeight: 'bold' },
  description: { color: '#666', marginBottom: 16, lineHeight: 20 },
  loader: { marginVertical: 20 },
  primaryButton: { paddingVertical: 8, marginBottom: 16 },
  dangerButton: { paddingVertical: 8, marginBottom: 16 },
  pinCard: { backgroundColor: '#fff3e0', marginBottom: 16 },
  pinContent: { alignItems: 'center', paddingVertical: 20 },
  pinLabel: { color: '#f57f17', marginBottom: 8 },
  pinText: { color: '#f57f17', fontWeight: 'bold', letterSpacing: 8 },
  pinSubtext: { color: '#999', marginTop: 8 },
  statsCard: { marginBottom: 16, backgroundColor: '#f3e5f5' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statLabel: { color: '#666', marginBottom: 8 },
  statNumber: { color: '#7b1fa2', fontWeight: 'bold' },
  // NEW styles
  pendingCard: {
    backgroundColor: '#fff8e1',
    borderColor: '#f59e0b',
    borderWidth: 1,
    marginBottom: 12,
  },
  pendingContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingIcon: { fontSize: 20 },
  pendingTextWrap: { flex: 1 },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  pendingSubtitle: { fontSize: 11, color: '#b45309', marginTop: 2 },
  syncingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14, backgroundColor: '#e3f2fd',
    borderRadius: 8, marginBottom: 16,
  },
  syncingText: { fontSize: 13, color: '#1976d2', fontWeight: '600' },
  studentsList: { gap: 8 },
  studentCard: { marginBottom: 8 },
  cardContent: { paddingVertical: 8 },
  studentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  enrollmentNo: { color: '#999', marginTop: 4 },
  presentChip: { backgroundColor: '#4caf50' },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 20 },
});