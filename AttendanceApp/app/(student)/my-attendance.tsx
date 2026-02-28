import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  ActivityIndicator,
  Snackbar,
  Card,
  SegmentedButtons,
} from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { calculatePercentage, formatDate, getAttendanceColor } from '../../lib/utils';
import { Student } from '../../types';

interface AttendanceDetail {
  session_id: string;
  date: string;
  subject: string;
  teacher_name: string;
  status: 'present' | 'absent';
  marked_at: string | null;
}

export default function MyAttendanceScreen() {
  const { user } = useAuthStore();
  const student = user?.data as Student;

  const [records, setRecords] = useState<AttendanceDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [viewMode, setViewMode] = useState<'all' | 'present' | 'absent'>('all');

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const { data: recordData, error: recordError } = await supabase
        .from('attendance_record')
        .select(
          `
          id,
          session_id,
          status,
          marked_at,
          attendance_session (
            date,
            subject,
            teacher: teacher_id (name)
          )
        `
        )
        .eq('student_id', student.id)
        .order('attendance_session.date', { ascending: false });

      if (recordError) throw recordError;

      const formattedRecords: AttendanceDetail[] = (recordData || []).map((record: any) => ({
        session_id: record.session_id,
        date: record.attendance_session.date,
        subject: record.attendance_session.subject,
        teacher_name: record.attendance_session.teacher?.name || 'Unknown',
        status: record.status,
        marked_at: record.marked_at,
      }));

      setRecords(formattedRecords);

      // Calculate statistics
      const total = formattedRecords.length;
      const present = formattedRecords.filter((r) => r.status === 'present').length;
      const calc = calculatePercentage(present, total);

      setTotalSessions(total);
      setPresentCount(present);
      setPercentage(calc);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendance();
    setRefreshing(false);
  };

  const filteredRecords = records.filter((r) => {
    if (viewMode === 'all') return true;
    return r.status === viewMode;
  });

  const getStatusDisplay = (status: 'present' | 'absent') => {
    return status === 'present' ? '✓ Present' : '✗ Absent';
  };

  const getStatusColor = (status: 'present' | 'absent') => {
    return status === 'present' ? '#4caf50' : '#f44336';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && records.length === 0 ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : (
          <>
            {/* Overall Statistics */}
            <Card style={styles.statsCard}>
              <Card.Content style={styles.statsContent}>
                <View style={styles.percentageContainer}>
                  <View
                    style={[
                      styles.percentageCircle,
                      {
                        borderColor: getAttendanceColor(percentage),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.percentageText,
                        {
                          color: getAttendanceColor(percentage),
                        },
                      ]}
                    >
                      {percentage.toFixed(1)}%
                    </Text>
                  </View>

                  <View style={styles.statsDetails}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Present</Text>
                      <Text
                        variant="titleMedium"
                        style={{
                          color: '#4caf50',
                          fontWeight: 'bold',
                        }}
                      >
                        {presentCount}
                      </Text>
                    </View>

                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Total</Text>
                      <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                        {totalSessions}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Status Message */}
                <View style={styles.statusMessage}>
                  {percentage >= 75 ? (
                    <>
                      <Text style={styles.goodEmoji}>✓</Text>
                      <Text variant="labelSmall" style={styles.goodText}>
                        You meet the minimum attendance requirement (75%)
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.warningEmoji}>!</Text>
                      <Text variant="labelSmall" style={styles.warningText}>
                        Attendance below 75%. Please be more regular.
                      </Text>
                    </>
                  )}
                </View>
              </Card.Content>
            </Card>

            {/* View Mode Toggle */}
            <View style={styles.toggleContainer}>
              <Text variant="labelSmall" style={styles.toggleLabel}>
                Filter:
              </Text>
              <SegmentedButtons
                value={viewMode}
                onValueChange={(value: any) => setViewMode(value)}
                buttons={[
                  { value: 'all', label: 'All' },
                  { value: 'present', label: 'Present' },
                  { value: 'absent', label: 'Absent' },
                ]}
                style={styles.segmentedButtons}
              />
            </View>

            {/* Attendance Records */}
            <View style={styles.recordsContainer}>
              <Text variant="titleSmall" style={styles.recordsTitle}>
                Attendance Records ({filteredRecords.length})
              </Text>

              {filteredRecords.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Card.Content>
                    <Text style={styles.emptyText}>
                      {totalSessions === 0
                        ? 'No attendance records yet'
                        : `No ${viewMode} records found`}
                    </Text>
                  </Card.Content>
                </Card>
              ) : (
                <View style={styles.recordsList}>
                  {filteredRecords.map((record) => (
                    <Card key={record.session_id} style={styles.recordCard}>
                      <Card.Content style={styles.recordContent}>
                        <View style={styles.recordHeader}>
                          <View style={styles.recordInfo}>
                            <Text variant="titleSmall">{record.subject}</Text>
                            <Text variant="bodySmall" style={styles.teacherName}>
                              {record.teacher_name}
                            </Text>
                            <Text variant="labelSmall" style={styles.date}>
                              {formatDate(record.date)}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: getStatusColor(record.status),
                              },
                            ]}
                          >
                            <Text style={styles.statusBadgeText}>
                              {getStatusDisplay(record.status)}
                            </Text>
                          </View>
                        </View>

                        {record.marked_at && (
                          <Text variant="labelSmall" style={styles.markedAt}>
                            Marked at {new Date(record.marked_at).toLocaleTimeString()}
                          </Text>
                        )}
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Snackbar visible={!!error} onDismiss={() => setError('')} duration={4000}>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  loader: {
    marginVertical: 40,
  },
  statsCard: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  statsContent: {
    paddingVertical: 20,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  percentageCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  percentageText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statsDetails: {
    flex: 1,
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    marginBottom: 4,
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  goodEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  goodText: {
    color: '#388e3c',
    flex: 1,
    lineHeight: 16,
  },
  warningEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  warningText: {
    color: '#d32f2f',
    flex: 1,
    lineHeight: 16,
  },
  toggleContainer: {
    marginBottom: 16,
    gap: 8,
  },
  toggleLabel: {
    color: '#666',
    fontWeight: '600',
  },
  segmentedButtons: {
    marginTop: 8,
  },
  recordsContainer: {
    marginBottom: 20,
  },
  recordsTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  recordsList: {
    gap: 8,
  },
  recordCard: {
    marginBottom: 4,
  },
  recordContent: {
    paddingVertical: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recordInfo: {
    flex: 1,
  },
  teacherName: {
    color: '#999',
    marginTop: 2,
  },
  date: {
    color: '#bbb',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  statusBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  markedAt: {
    color: '#999',
    marginTop: 8,
  },
  emptyCard: {
    marginTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
  },
});
