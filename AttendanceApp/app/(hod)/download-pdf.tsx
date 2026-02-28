import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Snackbar, Card } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { calculatePercentage, formatDate } from '../../lib/utils';
import { AttendanceSummary, Teacher } from '../../types';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function DownloadPDFScreen() {
  const { user } = useAuthStore();
  const hodId = (user?.data as any)?.id;

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  React.useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const { data, error: err } = await supabase
        .from('teacher')
        .select('*')
        .eq('hod_id', hodId)
        .order('subject');

      if (err) throw err;
      setTeachers(data || []);
      if (data && data.length > 0) {
        setSelectedTeacher(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch teachers');
    }
  };

  const generatePDF = async () => {
    if (!selectedTeacher) {
      setError('Please select a teacher');
      return;
    }

    setLoading(true);
    try {
      const teacher = teachers.find((t) => t.id === selectedTeacher);
      if (!teacher) throw new Error('Teacher not found');

      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];

      // Get all sessions in date range
      const { data: sessions, error: sessionError } = await supabase
        .from('attendance_session')
        .select('id')
        .eq('teacher_id', selectedTeacher)
        .gte('date', fromDateStr)
        .lte('date', toDateStr);

      if (sessionError) throw sessionError;

      const sessionIds = sessions?.map((s) => s.id) || [];

      if (sessionIds.length === 0) {
        setError('No attendance records found for the selected period');
        setLoading(false);
        return;
      }

      // Get all students for the teacher's year
      const { data: students, error: studentError } = await supabase
        .from('student')
        .select('*')
        .eq('hod_id', hodId)
        .eq('year', teacher.year)
        .order('name');

      if (studentError) throw studentError;

      // Get all attendance records
      const { data: records, error: recordError } = await supabase
        .from('attendance_record')
        .select('*')
        .in('session_id', sessionIds);

      if (recordError) throw recordError;

      // Build attendance summary
      const summaries: AttendanceSummary[] = (students || [])
        .map((student) => {
          const presentCount =
            records?.filter((r) => r.student_id === student.id && r.status === 'present')
              .length || 0;

          const percentage = calculatePercentage(presentCount, sessionIds.length);

          return {
            student,
            total_sessions: sessionIds.length,
            present_count: presentCount,
            absent_count: sessionIds.length - presentCount,
            percentage,
          };
        })
        .sort((a, b) => a.percentage - b.percentage);

      // Generate HTML
      const htmlContent = generatePDFHTML(summaries, {
        subject: teacher.subject,
        year: teacher.year,
        from: formatDate(fromDateStr),
        to: formatDate(toDateStr),
      });

      // Create PDF
      const options = {
        html: htmlContent,
        fileName: `attendance_${teacher.subject}_${fromDateStr}_to_${toDateStr}`,
        directory: FileSystem.DocumentDirectoryPath,
        padding: 10,
        width: 595,
        height: 842,
      };

      const { filePath } = await RNHTMLtoPDF.convert(options);

      if (filePath) {
        await Sharing.shareAsync(filePath);
        setSuccess('PDF generated and sharing dialog opened');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Generate Attendance Report
          </Text>

          <Text style={styles.label}>Teacher (Subject)</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedTeacher}
              onValueChange={setSelectedTeacher}
              enabled={!loading}
            >
              {teachers.map((teacher) => (
                <Picker.Item
                  key={teacher.id}
                  label={`${teacher.subject} - ${teacher.name}`}
                  value={teacher.id}
                />
              ))}
            </Picker>
          </View>

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
              onChange={(event, date) => {
                setShowFromPicker(false);
                if (date) setFromDate(date);
              }}
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
              onChange={(event, date) => {
                setShowToPicker(false);
                if (date) setToDate(date);
              }}
            />
          )}

          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : (
            <Button
              mode="contained"
              onPress={generatePDF}
              style={styles.button}
            >
              Generate & Download PDF
            </Button>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text variant="labelSmall" style={styles.infoLabel}>
                Note:
              </Text>
              <Text variant="bodySmall" style={styles.infoText}>
                • PDF will include all students from the selected teacher's year{'\n'}
                • Shows attendance percentage for the selected date range{'\n'}
                • Students below 75% are highlighted in red
              </Text>
            </Card.Content>
          </Card>
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

const generatePDFHTML = (data: AttendanceSummary[], filters: any): string => `
  <html>
    <head>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px; 
          color: #333;
        }
        h1 { 
          color: #1a73e8; 
          font-size: 18px; 
          margin-bottom: 5px;
        }
        .meta {
          font-size: 12px;
          color: #666;
          margin-bottom: 20px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px;
          font-size: 11px;
        }
        th { 
          background: #1a73e8; 
          color: white; 
          padding: 8px; 
          text-align: left;
          font-weight: bold;
        }
        td { 
          padding: 6px 8px; 
          border-bottom: 1px solid #ddd;
        }
        tr:nth-child(even) {
          background: #f9f9f9;
        }
        .low { 
          color: #d32f2f; 
          font-weight: bold; 
        }
        .good { 
          color: #388e3c;
        }
      </style>
    </head>
    <body>
      <h1>Attendance Report</h1>
      <div class="meta">
        <strong>${filters.subject}</strong> | Year ${filters.year}<br/>
        Period: ${filters.from} to ${filters.to}
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Enrollment No</th>
            <th>Present</th>
            <th>Total</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (s) => `
            <tr>
              <td>${s.student.name}</td>
              <td>${s.student.enrollment_no}</td>
              <td>${s.present_count}</td>
              <td>${s.total_sessions}</td>
              <td class="${s.percentage < 75 ? 'low' : 'good'}">
                ${s.percentage.toFixed(1)}%
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </body>
  </html>
`;

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
    marginBottom: 16,
    fontWeight: 'bold',
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
    marginBottom: 16,
  },
  dateButton: {
    marginBottom: 12,
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
  },
  loader: {
    marginVertical: 20,
  },
  infoContainer: {
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#e8f5e9',
  },
  infoLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    lineHeight: 18,
  },
});
