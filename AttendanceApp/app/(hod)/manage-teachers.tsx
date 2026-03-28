import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator, Snackbar, Card, IconButton, Divider } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Teacher } from '../../types';
import * as Crypto from 'expo-crypto';

export default function ManageTeachersScreen() {
  const { user } = useAuthStore();
  const hodId = (user?.data as any)?.id;

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState<1 | 2 | 3 | 4>(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('teacher')
        .select('*')
        .eq('hod_id', hodId)
        .order('subject')
        .order('name');

      if (err) throw err;
      setTeachers(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch teachers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!name || !subject || !username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Hash password
      const password_hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password
      );

      const { data, error: err } = await supabase
        .from('teacher')
        .insert([
          {
            hod_id: hodId,
            name,
            subject,
            year,
            username,
            password_hash,
          },
        ])
        .select();

      if (err) throw err;

      setTeachers([...teachers, data[0]]);
      setName('');
      setSubject('');
      setYear(1);
      setUsername('');
      setPassword('');
      setSuccess('Teacher added successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to add teacher');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    setLoading(true);
    try {
      const { error: err } = await supabase
        .from('teacher')
        .delete()
        .eq('id', teacherId);

      if (err) throw err;

      setTeachers(teachers.filter((t) => t.id !== teacherId));
      setSuccess('Teacher deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete teacher');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Add New Teacher
          </Text>

          <TextInput
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter teacher name"
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g., Mathematics"
            style={styles.input}
            disabled={loading}
          />

          <Text style={styles.label}>Year</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={year}
              onValueChange={(value) => setYear(value)}
              enabled={!loading}
              style={styles.picker}
              dropdownIconColor="#333"
            >
              <Picker.Item label="Year 1" value={1} color="#fff" />
              <Picker.Item label="Year 2" value={2} color="#fff" />
              <Picker.Item label="Year 3" value={3} color="#fff" />
              <Picker.Item label="Year 4" value={4} color="#fff" />
            </Picker>
          </View>

          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="e.g., mrsmith"
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
            style={styles.input}
            disabled={loading}
          />

          {loading ? (
            <ActivityIndicator size="large" style={styles.loader} />
          ) : (
            <Button mode="contained" onPress={handleAddTeacher} style={styles.button}>
              Add Teacher
            </Button>
          )}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.listContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            All Teachers ({teachers.length})
          </Text>

          {teachers.length === 0 ? (
            <Text style={styles.emptyText}>No teachers added yet</Text>
          ) : (
            teachers.map((teacher) => (
              <Card key={teacher.id} style={styles.teacherCard}>
                <Card.Content style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text variant="titleSmall">{teacher.name}</Text>
                      <Text variant="bodySmall" style={styles.subtitle}>
                        {teacher.subject} • Year {teacher.year}
                      </Text>
                      <Text variant="bodySmall" style={styles.subtitle}>
                        @{teacher.username}
                      </Text>
                    </View>
                    <IconButton
                      icon="delete"
                      iconColor="red"
                      size={20}
                      onPress={() => handleDeleteTeacher(teacher.id)}
                      disabled={loading}
                    />
                  </View>
                </Card.Content>
              </Card>
            ))
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
  picker:{
    color:'#333'
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
  teacherCard: {
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
