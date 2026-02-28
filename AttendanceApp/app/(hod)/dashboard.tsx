import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList } from 'react-native';
import { Text, Card, ActivityIndicator, Snackbar, Chip } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { calculatePercentage, getAttendanceColor } from '../../lib/utils';
import { Teacher, AttendanceSession, AttendanceRecord, Student } from '../../types';

interface SubjectSummary {
  teacher: Teacher;
  totalSessions: number;
  averagePercentage: number;
  studentCount: number;
}

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const hodId = (user?.data as any)?.id;

  const [summaries, setSummaries] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, [selectedYear]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      // Get all teachers for this HOD
      const { data: teachers, error: teacherError } = await supabase
        .from('teacher')
        .select('*')
        .eq('hod_id', hodId);

      if (teacherError) throw teacherError;

      const summaryList: SubjectSummary[] = [];

      for (const teacher of teachers) {
        // Apply year filter if selected
        const queryYear = selectedYear ? selectedYear : teacher.year;

        // Get all sessions for this teacher
        const { data: sessions, error: sessionError } = await supabase
          .from('attendance_session')
          .select('*')
          .eq('teacher_id', teacher.id)
          .eq('year', queryYear);

        if (sessionError) throw sessionError;

        const sessionIds = sessions?.map((s) => s.id) || [];

        if (sessionIds.length === 0) {
          summaryList.push({
            teacher,
            totalSessions: 0,
            averagePercentage: 0,
            studentCount: 0,
          });
          continue;
        }

        // Get all students for this year
        const { data: students, error: studentError } = await supabase
          .from('student')
          .select('*')
          .eq('hod_id', hodId)
          .eq('year', queryYear);

        if (studentError) throw studentError;

        // Get all attendance records for these sessions
        const { data: records, error: recordError } = await supabase
          .from('attendance_record')
          .select('*')
          .in('session_id', sessionIds);

        if (recordError) throw recordError;

        // Calculate average percentage
        let totalPercentage = 0;
        let studentWithAttendance = 0;

        for (const student of students || []) {
          const presentCount = records?.filter(
            (r) => r.student_id === student.id && r.status === 'present'
          ).length || 0;

          const percentage = calculatePercentage(presentCount, sessionIds.length);

          if (percentage > 0 || presentCount > 0) {
            totalPercentage += percentage;
            studentWithAttendance++;
          }
        }

        const avgPercentage =
          studentWithAttendance > 0 ? totalPercentage / studentWithAttendance : 0;

        summaryList.push({
          teacher,
          totalSessions: sessionIds.length,
          averagePercentage: avgPercentage,
          studentCount: students?.length || 0,
        });
      }

      setSummaries(summaryList.sort((a, b) => b.averagePercentage - a.averagePercentage));
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const years = [1, 2, 3, 4];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        <View style={styles.filterContainer}>
          <Text variant="labelMedium" style={styles.filterLabel}>
            Filter by Year:
          </Text>
          <View style={styles.chipRow}>
            <Chip
              selected={selectedYear === null}
              onPress={() => setSelectedYear(null)}
              style={styles.chip}
            >
              All
            </Chip>
            {years.map((year) => (
              <Chip
                key={year}
                selected={selectedYear === year}
                onPress={() => setSelectedYear(year)}
                style={styles.chip}
              >
                Year {year}
              </Chip>
            ))}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : summaries.length === 0 ? (
          <Text style={styles.emptyText}>No subjects found. Create teachers to get started.</Text>
        ) : (
          <View style={styles.cardsContainer}>
            {summaries.map((summary) => (
              <Card key={summary.teacher.id} style={styles.card}>
                <Card.Content style={styles.cardContent}>
                  <Text variant="titleSmall" style={styles.subject}>
                    {summary.teacher.subject}
                  </Text>
                  <Text variant="bodySmall" style={styles.teacher}>
                    {summary.teacher.name}
                  </Text>

                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Text variant="labelSmall" style={styles.statLabel}>
                        Sessions
                      </Text>
                      <Text variant="titleMedium">{summary.totalSessions}</Text>
                    </View>

                    <View style={styles.stat}>
                      <Text variant="labelSmall" style={styles.statLabel}>
                        Students
                      </Text>
                      <Text variant="titleMedium">{summary.studentCount}</Text>
                    </View>

                    <View
                      style={[
                        styles.stat,
                        {
                          borderLeftWidth: 1,
                          borderLeftColor: '#e0e0e0',
                          paddingLeft: 12,
                        },
                      ]}
                    >
                      <Text variant="labelSmall" style={styles.statLabel}>
                        Avg. %
                      </Text>
                      <Text
                        variant="titleMedium"
                        style={{
                          color: getAttendanceColor(summary.averagePercentage),
                          fontWeight: 'bold',
                        }}
                      >
                        {summary.averagePercentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
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
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    marginBottom: 8,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  loader: {
    marginVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 40,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  cardContent: {
    paddingVertical: 16,
  },
  subject: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  teacher: {
    color: '#666',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    color: '#999',
    marginBottom: 4,
  },
});
