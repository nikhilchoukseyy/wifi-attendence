// import React, { useState } from 'react';
// import { View, StyleSheet, ScrollView } from 'react-native';
// import { TextInput, Button, Text, ActivityIndicator, Snackbar, Card } from 'react-native-paper';
// import { Picker } from '@react-native-picker/picker';
// import DateTimePicker from '@react-native-community/datetimepicker';
// import { useAuthStore } from '../../store/authStore';
// import { supabase } from '../../lib/supabase';
// import { calculatePercentage, formatDate } from '../../lib/utils';
// import { AttendanceSummary, Teacher } from '../../types';
// import * as Print from 'expo-print';
// import * as Sharing from 'expo-sharing';

// export default function DownloadPDFScreen() {
//   const { user } = useAuthStore();
//   const hodId = (user?.data as any)?.id;

//   const [teachers, setTeachers] = useState<Teacher[]>([]);
//   const [selectedTeacher, setSelectedTeacher] = useState<string>('');
//   const [fromDate, setFromDate] = useState(new Date());
//   const [toDate, setToDate] = useState(new Date());
//   const [showFromPicker, setShowFromPicker] = useState(false);
//   const [showToPicker, setShowToPicker] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [success, setSuccess] = useState('');

//   React.useEffect(() => {
//     fetchTeachers();
//   }, []);

//   const fetchTeachers = async () => {
//     try {
//       const { data, error: err } = await supabase
//         .from('teacher')
//         .select('*')
//         .eq('hod_id', hodId)
//         .order('subject');

//       if (err) throw err;
//       setTeachers(data || []);
//       if (data && data.length > 0) {
//         setSelectedTeacher(data[0].id);
//       }
//     } catch (err: any) {
//       setError(err.message || 'Failed to fetch teachers');
//     }
//   };

//   const generatePDF = async () => {
//     if (!selectedTeacher) {
//       setError('Please select a teacher');
//       return;
//     }

//     setLoading(true);
//     try {
//       const teacher = teachers.find((t) => t.id === selectedTeacher);
//       if (!teacher) throw new Error('Teacher not found');

//       const fromDateStr = fromDate.toISOString().split('T')[0];
//       const toDateStr = toDate.toISOString().split('T')[0];

//       // Get all sessions in date range
//       const { data: sessions, error: sessionError } = await supabase
//         .from('attendance_session')
//         .select('id')
//         .eq('teacher_id', selectedTeacher)
//         .gte('date', fromDateStr)
//         .lte('date', toDateStr);

//       if (sessionError) throw sessionError;

//       const sessionIds = sessions?.map((s) => s.id) || [];

//       if (sessionIds.length === 0) {
//         setError('No attendance records found for the selected period');
//         setLoading(false);
//         return;
//       }

//       // Get all students for the teacher's year
//       const { data: students, error: studentError } = await supabase
//         .from('student')
//         .select('*')
//         .eq('hod_id', hodId)
//         .eq('year', teacher.year)
//         .order('name');

//       if (studentError) throw studentError;

//       // Get all attendance records
//       const { data: records, error: recordError } = await supabase
//         .from('attendance_record')
//         .select('*')
//         .in('session_id', sessionIds);

//       if (recordError) throw recordError;

//       // Build attendance summary
//       const summaries: AttendanceSummary[] = (students || [])
//         .map((student) => {
//           const presentCount =
//             records?.filter((r) => r.student_id === student.id && r.status === 'present')
//               .length || 0;

//           const percentage = calculatePercentage(presentCount, sessionIds.length);

//           return {
//             student,
//             total_sessions: sessionIds.length,
//             present_count: presentCount,
//             absent_count: sessionIds.length - presentCount,
//             percentage,
//           };
//         })
//         .sort((a, b) => a.percentage - b.percentage);

//       // Generate HTML
//       const htmlContent = generatePDFHTML(summaries, {
//         subject: teacher.subject,
//         year: teacher.year,
//         from: formatDate(fromDateStr),
//         to: formatDate(toDateStr),
//       });

//       // Create PDF
//       const { uri } = await Print.printToFileAsync({ html: htmlContent });

//       if (uri) {
//         await Sharing.shareAsync(uri);
//         setSuccess('PDF generated and sharing dialog opened');
//       }
//     } catch (err: any) {
//       setError(err.message || 'Failed to generate PDF');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <View style={styles.container}>
//       <ScrollView style={styles.scrollContent}>
//         <View style={styles.formContainer}>
//           <Text variant="titleMedium" style={styles.sectionTitle}>
//             Generate Attendance Report
//           </Text>

//           <Text style={styles.label}>Teacher (Subject)</Text>
//           <View style={styles.pickerContainer}>
//             <Picker
//               selectedValue={selectedTeacher}
//               onValueChange={setSelectedTeacher}
//               enabled={!loading}
//               style={styles.picker}
//               dropdownIconColor="#333"
//             >
//               {teachers.map((teacher) => (
//                 <Picker.Item
//                   key={teacher.id}
//                   label={`${teacher.subject} - ${teacher.name}`}
//                   value={teacher.id}
//                   color="#333"

//                 />
//               ))}
//             </Picker>
//           </View>

//           <Button
//             mode="outlined"
//             onPress={() => setShowFromPicker(true)}
//             style={styles.dateButton}
//           >
//             From: {formatDate(fromDate.toISOString().split('T')[0])}
//           </Button>

//           {showFromPicker && (
//             <DateTimePicker
//               value={fromDate}
//               mode="date"
//               display="default"
//               onChange={(event, date) => {
//                 setShowFromPicker(false);
//                 if (date) setFromDate(date);
//               }}
//             />
//           )}

//           <Button
//             mode="outlined"
//             onPress={() => setShowToPicker(true)}
//             style={styles.dateButton}
//           >
//             To: {formatDate(toDate.toISOString().split('T')[0])}
//           </Button>

//           {showToPicker && (
//             <DateTimePicker
//               value={toDate}
//               mode="date"
//               display="default"
//               onChange={(event, date) => {
//                 setShowToPicker(false);
//                 if (date) setToDate(date);
//               }}
//             />
//           )}

//           {loading ? (
//             <ActivityIndicator size="large" style={styles.loader} />
//           ) : (
//             <Button
//               mode="contained"
//               onPress={generatePDF}
//               style={styles.button}
//             >
//               Generate & Download PDF
//             </Button>
//           )}
//         </View>

//         <View style={styles.infoContainer}>
//           <Card style={styles.infoCard}>
//             <Card.Content>
//               <Text variant="labelSmall" style={styles.infoLabel}>
//                 Note:
//               </Text>
//               <Text variant="bodySmall" style={styles.infoText}>
//                 • PDF will include all students from the selected teacher's year{'\n'}
//                 • Shows attendance percentage for the selected date range{'\n'}
//                 • Students below 75% are highlighted in red
//               </Text>
//             </Card.Content>
//           </Card>
//         </View>
//       </ScrollView>

//       <Snackbar visible={!!error} onDismiss={() => setError('')} duration={4000}>
//         {error}
//       </Snackbar>
//       <Snackbar visible={!!success} onDismiss={() => setSuccess('')} duration={3000}>
//         {success}
//       </Snackbar>
//     </View>
//   );
// }

// const generatePDFHTML = (data: AttendanceSummary[], filters: any): string => `
//   <html>
//     <head>
//       <style>
//         body { 
//           font-family: Arial, sans-serif; 
//           padding: 20px; 
//           color: #333;
//         }
//         h1 { 
//           color: #1a73e8; 
//           font-size: 18px; 
//           margin-bottom: 5px;
//         }
//         .meta {
//           font-size: 12px;
//           color: #666;
//           margin-bottom: 20px;
//         }
//         table { 
//           width: 100%; 
//           border-collapse: collapse; 
//           margin-top: 10px;
//           font-size: 11px;
//         }
//         th { 
//           background: #1a73e8; 
//           color: white; 
//           padding: 8px; 
//           text-align: left;
//           font-weight: bold;
//         }
//         td { 
//           padding: 6px 8px; 
//           border-bottom: 1px solid #ddd;
//         }
//         tr:nth-child(even) {
//           background: #f9f9f9;
//         }
//         .low { 
//           color: #d32f2f; 
//           font-weight: bold; 
//         }
//         .good { 
//           color: #388e3c;
//         }
//       </style>
//     </head>
//     <body>
//       <h1>Attendance Report</h1>
//       <div class="meta">
//         <strong>${filters.subject}</strong> | Year ${filters.year}<br/>
//         Period: ${filters.from} to ${filters.to}
//       </div>
//       <table>
//         <thead>
//           <tr>
//             <th>Name</th>
//             <th>Enrollment No</th>
//             <th>Present</th>
//             <th>Total</th>
//             <th>Percentage</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${data
//             .map(
//               (s) => `
//             <tr>
//               <td>${s.student.name}</td>
//               <td>${s.student.enrollment_no}</td>
//               <td>${s.present_count}</td>
//               <td>${s.total_sessions}</td>
//               <td class="${s.percentage < 75 ? 'low' : 'good'}">
//                 ${s.percentage.toFixed(1)}%
//               </td>
//             </tr>
//           `
//             )
//             .join('')}
//         </tbody>
//       </table>
//     </body>
//   </html>
// `;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#f5f5f5',
//   },
//   scrollContent: {
//     paddingHorizontal: 16,
//     paddingVertical: 16,
//   },
//   formContainer: {
//     backgroundColor: '#fff',
//     borderRadius: 8,
//     padding: 16,
//     marginBottom: 16,
//   },
//   sectionTitle: {
//     marginBottom: 16,
//     fontWeight: 'bold',
//   },
//   label: {
//     fontSize: 14,
//     fontWeight: '500',
//     marginBottom: 8,
//   },
//   pickerContainer: {
//     borderWidth: 1,
//     borderColor: '#e0e0e0',
//     borderRadius: 4,
//     marginBottom: 16,
//   },
//   dateButton: {
//     marginBottom: 12,
//   },
//   button: {
//     marginTop: 16,
//     paddingVertical: 8,
//   },
//   loader: {
//     marginVertical: 20,
//   },
//   infoContainer: {
//     marginBottom: 20,
//   },
//   infoCard: {
//     backgroundColor: '#e8f5e9',
//   },
//   infoLabel: {
//     fontWeight: 'bold',
//     marginBottom: 8,
//   },
//   infoText: {
//     lineHeight: 18,
//   },
// });


import React, { useState } from 'react';
import { View, Alert, ScrollView } from 'react-native';
import { Button, Text, Card, Divider, ActivityIndicator } from 'react-native-paper';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { TextInput as RNTextInput } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubjectStat {
  total: number;
  present: number;
}

interface StudentRow {
  enrollment_no: string;
  name: string;
  subjects: Record<string, SubjectStat>; // key = subject name
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DownloadPDFScreen() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<StudentRow[] | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [cutoff, setCutoff] = useState<number>(75); // default 75

  // ── Step 1: Fetch & calculate ──────────────────────────────────────────────

  const fetchAttendanceData = async (): Promise<{
    studentRows: StudentRow[];
    subjectList: string[];
  }> => {

    // ✅ Get unique subjects from sessions (NOT from teacher table)
    const { data: sessions, error: sesErr } = await supabase
      .from('attendance_session')
      .select('subject');
    if (sesErr) throw new Error(sesErr.message);

    const subjectList = [...new Set(sessions!.map((s) => s.subject as string))].sort();

    // Get all students
    const { data: students, error: sErr } = await supabase
      .from('student')
      .select('id, enrollment_no, name')
      .order('enrollment_no', { ascending: true });
    if (sErr) throw new Error(sErr.message);

    const studentMap: Record<string, StudentRow> = {};
    for (const s of students!) {
      studentMap[s.id] = {
        enrollment_no: s.enrollment_no,
        name: s.name,
        subjects: Object.fromEntries(
          subjectList.map((sub) => [sub, { total: 0, present: 0 }])
        ),
      };
    }

    // ✅ Correct join — subject lives on attendance_session, no need to go to teacher
    const { data: records, error: rErr } = await supabase
      .from('attendance_record')
      .select(`
      student_id,
      status,
      attendance_session (
        subject
      )
    `);
    if (rErr) throw new Error(rErr.message);

    for (const record of records!) {
      const session = record.attendance_session as any;
      const subject: string = session?.subject;         // ✅ directly from session
      const studentId: string = record.student_id;

      if (!subject || !studentMap[studentId]) continue;

      if (!studentMap[studentId].subjects[subject]) {
        studentMap[studentId].subjects[subject] = { total: 0, present: 0 };
      }

      studentMap[studentId].subjects[subject].total += 1;
      if (record.status === 'present') {
        studentMap[studentId].subjects[subject].present += 1;
      }
    }

    return { studentRows: Object.values(studentMap), subjectList };
  };

  // ── Step 2: 75% check ─────────────────────────────────────────────────────

  const getStatus = (stat: SubjectStat, cutoffPct: number): 'E' | 'D' => {
    if (stat.total === 0) return 'E';
    const pct = (stat.present / stat.total) * 100;
    return pct >= cutoffPct ? 'E' : 'D';
  };

  // ── Step 3: Build HTML matching the college format ────────────────────────

  const buildHTML = (rows: StudentRow[], subjectList: string[]): string => {
    const headerCells = subjectList.map((s) => `<th>${s}</th>`).join('');

    const tableRows = rows
      .map((student, idx) => {
        const cells = subjectList
          .map((sub) => {
            const stat = student.subjects[sub] ?? { total: 0, present: 0 };
            const status = getStatus(stat, cutoff);
            const bgColor = status === 'D' ? 'background:#ccc;' : '';
            return `<td style="${bgColor}">${status}</td>`;
          })
          .join('');

        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${student.enrollment_no}</td>
            <td class="left">${student.name.toUpperCase()}</td>
            ${cells}
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10px; padding: 20px; }
          h2, h3 { text-align: center; margin-bottom: 2px; font-size: 13px; }
          h3 { font-size: 11px; font-weight: normal; }
          .title-bold { font-weight: bold; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th {
            background: #000; color: #fff;
            border: 1px solid #000;
            padding: 5px 4px;
            text-align: center;
            font-size: 10px;
          }
          td {
            border: 1px solid #000;
            padding: 4px;
            text-align: center;
          }
          td.left { text-align: left; padding-left: 6px; }
          tr:nth-child(even) { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h2>DoIT, UIT RGPV Bhopal</h2>
        <h3>Session: Jan - June 2026</h3>
        <h2 class="title-bold">Detention List (VI Semester) MST 1</h2>
        <table>
          <thead>
            <tr>
              <th>S.NO.</th>
              <th>Enrolment No.</th>
              <th>NAME</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <p style="margin-top:20px; font-size:9px; color:#555;">
          E = Eligible (&ge;75%) &nbsp;&nbsp; D = Detained (&lt;75%)
        </p>
      </body>
      </html>
    `;
  };

  // ── Step 4: Print to PDF and share ────────────────────────────────────────

  const handleGeneratePDF = async () => {
    setLoading(true);
    try {
      const { studentRows, subjectList } = await fetchAttendanceData();
      setPreview(studentRows);
      setSubjects(subjectList);

      const html = buildHTML(studentRows, subjectList);

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Detention Report',
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      Alert.alert('Error generating report', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Card.Title
          title="Detention List Report"
        />
        <Card.Content>
          <Text variant="labelLarge" style={{ marginBottom: 6 }}>
            Attendance Cutoff (%)
          </Text>
          <RNTextInput
            value={String(cutoff)}
            onChangeText={(val) => {
              const num = parseInt(val);
              if (!isNaN(num) && num >= 0 && num <= 100) {
                setCutoff(num);
              } else if (val === '') {
                setCutoff(0);
              }
            }}
            keyboardType="numeric"
            maxLength={3}
            style={{
              borderWidth: 1,
              borderColor: '#888',
              borderRadius: 8,
              padding: 10,
              fontSize: 16,
              width: 100,
              marginBottom: 8,
            }}
            placeholder="e.g. 75"
          />
          <Text variant="bodySmall" style={{ color: '#888', marginBottom: 12 }}>
            Students below {cutoff}% in any subject will be marked D (Detained)
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button
            mode="contained"
            icon="file-pdf-box"
            onPress={handleGeneratePDF}
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate & Export PDF'}
          </Button>
        </Card.Actions>
      </Card>

      {/* Quick preview after generation */}
      {preview && subjects.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <Card.Title title={`Preview — ${preview.length} students`} />
          <Card.Content>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ width: 140, fontWeight: 'bold', fontSize: 11 }}>NAME</Text>
              {subjects.map((s) => (
                <Text key={s} style={{ width: 45, fontWeight: 'bold', fontSize: 11, textAlign: 'center' }}>
                  {s}
                </Text>
              ))}
            </View>
            <Divider />
            {preview.slice(0, 10).map((row) => (
              <View key={row.enrollment_no} style={{ flexDirection: 'row', paddingVertical: 3 }}>
                <Text style={{ width: 140, fontSize: 10 }} numberOfLines={1}>
                  {row.name}
                </Text>
                {subjects.map((s) => {
                  const stat = row.subjects[s] ?? { total: 0, present: 0 };
                  const status = getStatus(stat, cutoff);
                  return (
                    <Text
                      key={s}
                      style={{
                        width: 45,
                        fontSize: 10,
                        textAlign: 'center',
                        color: status === 'D' ? 'red' : 'green',
                        fontWeight: 'bold',
                      }}
                    >
                      {status}
                    </Text>
                  );
                })}
              </View>
            ))}
            {preview.length > 10 && (
              <Text style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                ...and {preview.length - 10} more in the PDF
              </Text>
            )}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}