import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Button,
  Text,
  ActivityIndicator,
  Snackbar,
  Card,
  SegmentedButtons,
  Chip,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { calculatePercentage, formatDate, getAttendanceColor } from '../../lib/utils';
import { AttendanceSummary } from '../../types';

export default function FilterScreen() {
  const { user } = useAuthStore();
  const teacher = user?.data as any;
  const teacherId = teacher?.id;

  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [results, setResults] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOnlyLow, setShowOnlyLow] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setError('');

    try {
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];

      // Get all sessions in date range for this teacher
      const { data: sessions, error: sessionError } = await supabase
        .from('attendance_session')
        .select('id')
        .eq('teacher_id', teacherId)
        .gte('date', fromDateStr)
        .lte('date', toDateStr);

      if (sessionError) throw sessionError;

      const sessionIds = sessions?.map((s) => s.id) || [];

      if (sessionIds.length === 0) {
        setError('No attendance sessions found in the selected date range');
        setLoading(false);
        return;
      }

      const totalSessions = sessionIds.length;

      // Get all students for this teacher's year
      const { data: students, error: studentError } = await supabase
        .from('student')
        .select('*')
        .eq('year', teacher.year)
        .order('name');

      if (studentError) throw studentError;

      // Get all attendance records for these sessions
      const { data: records, error: recordError } = await supabase
        .from('attendance_record')
        .select('*')
        .in('session_id', sessionIds);

      if (recordError) throw recordError;

      // Build student map with attendance data
      const studentMap: Record<string, AttendanceSummary> = {};

      (students || []).forEach((student) => {
        const studentRecords = records?.filter((r) => r.student_id === student.id) || [];
        const presentCount = studentRecords.filter((r) => r.status === 'present').length;
        const percentage = calculatePercentage(presentCount, totalSessions);

        studentMap[student.id] = {
          student,
          total_sessions: totalSessions,
          present_count: presentCount,
          absent_count: totalSessions - presentCount,
          percentage,
        };
      });

      // Sort by percentage (ascending - lowest first)
      let sortedResults = Object.values(studentMap).sort(
        (a, b) => a.percentage - b.percentage
      );

      // Filter if only showing below 75%
      if (showOnlyLow) {
        sortedResults = sortedResults.filter((r) => r.percentage < 75);
      }

      setResults(sortedResults);
    } catch (err: any) {
      setError(err.message || 'Failed to search');
    } finally {
      setLoading(false);
    }
  };

  const handleFromDateChange = (event: any, date?: Date) => {
    setShowFromPicker(false);
    if (date) setFromDate(date);
  };

  const handleToDateChange = (event: any, date?: Date) => {
    setShowToPicker(false);
    if (date) setToDate(date);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        {/* Date Range Filters */}
        <View style={styles.filtersContainer}>
          <Text variant="titleMedium" style={styles.title}>
            Filter Attendance
          </Text>

          <Button
            mode="outlined"
            onPress={() => setShowFromPicker(true)}
            style={styles.dateButton}
          >
            From: {formatDate(fromDate.toISOString().split('T')[0])}
          </Button>

          {showFromPicker && (
            <DateTimePicker
              value={fromDate}
              mode="date"
              display="default"
              onChange={handleFromDateChange}
            />
          )}

          <Button
            mode="outlined"
            onPress={() => setShowToPicker(true)}
            style={styles.dateButton}
          >
            To: {formatDate(toDate.toISOString().split('T')[0])}
          </Button>

          {showToPicker && (
            <DateTimePicker
              value={toDate}
              mode="date"
              display="default"
              onChange={handleToDateChange}
            />
          )}

          {/* Toggle */}
          <View style={styles.toggleContainer}>
            <Text variant="labelSmall">Show only below 75%:</Text>
            <Chip
              selected={showOnlyLow}
              onPress={() => setShowOnlyLow(!showOnlyLow)}
              style={styles.toggleChip}
            >
              {showOnlyLow ? 'Yes' : 'No'}
            </Chip>
          </View>

          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : (
            <Button
              mode="contained"
              onPress={handleSearch}
              style={styles.searchButton}
            >
              🔍 Search
            </Button>
          )}
        </View>

        {/* Results */}
        {results.length > 0 && (
          <>
            <View style={styles.resultsHeader}>
              <Text variant="titleSmall" style={styles.resultsTitle}>
                Results ({results.length})
              </Text>
              <Text variant="labelSmall" style={styles.resultsSummary}>
                {results.filter((r) => r.percentage < 75).length} below 75%
              </Text>
            </View>

            <View style={styles.resultsList}>
              {results.map((summary) => (
                <Card key={summary.student.id} style={styles.resultCard}>
                  <Card.Content style={styles.resultContent}>
                    <View style={styles.resultHeader}>
                      <View style={styles.resultInfo}>
                        <Text variant="titleSmall">{summary.student.name}</Text>
                        <Text variant="bodySmall" style={styles.enrollment}>
                          {summary.student.enrollment_no}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.percentageBadge,
                          {
                            backgroundColor: getAttendanceColor(summary.percentage),
                          },
                        ]}
                      >
                        <Text style={styles.percentageText}>
                          {summary.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.statsRow}>
                      <Text variant="labelSmall" style={styles.stat}>
                        Present: {summary.present_count}/{summary.total_sessions}
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
          </>
        )}

        {results.length === 0 && !loading && (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>
                {showOnlyLow
                  ? 'No students below 75% attendance found.'
                  : 'Click Search to see attendance results'}
              </Text>
            </Card.Content>
          </Card>
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
  filtersContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  dateButton: {
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toggleChip: {
    marginLeft: 8,
  },
  searchButton: {
    paddingVertical: 8,
  },
  loader: {
    marginVertical: 20,
  },
  resultsHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsTitle: {
    fontWeight: 'bold',
  },
  resultsSummary: {
    color: '#d32f2f',
  },
  resultsList: {
    gap: 8,
    marginBottom: 20,
  },
  resultCard: {
    marginBottom: 4,
  },
  resultContent: {
    paddingVertical: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resultInfo: {
    flex: 1,
  },
  enrollment: {
    color: '#999',
    marginTop: 4,
  },
  percentageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statsRow: {
    marginTop: 8,
  },
  stat: {
    color: '#666',
  },
  emptyCard: {
    marginTop: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
  },
});
