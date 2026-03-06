import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { AttendanceRecord } from '../types';

const PENDING_PREFIX = 'pending_att_';


export const saveAttendanceLocally = async (
  record: AttendanceRecord
): Promise<void> => {
  const key = `${PENDING_PREFIX}${record.session_id}_${record.student_id}`;
  await AsyncStorage.setItem(key, JSON.stringify(record));
};


export const syncPendingRecords = async (): Promise<void> => {
  const allKeys = await AsyncStorage.getAllKeys();
  const pendingKeys = allKeys.filter(k => k.startsWith(PENDING_PREFIX));
  if (pendingKeys.length === 0) return;

  for (const key of pendingKeys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      const record: AttendanceRecord = JSON.parse(raw);

      const { error } = await supabase
        .from('attendance_record')
        .upsert({
          session_id: record.session_id,
          student_id: record.student_id,
          status: 'present',
          marked_at: record.local_timestamp,
          face_verified: record.face_verified,
          liveness_verified: record.liveness_verified,
          local_timestamp: record.local_timestamp,
          sync_status: 'synced',
        });

      if (!error) {
        await AsyncStorage.removeItem(key);
      } else {
        
        const updated = { ...record, sync_status: 'failed' as const };
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Sync error for key:', key, e);
    }
  }
};


export const getPendingCount = async (): Promise<number> => {
  const allKeys = await AsyncStorage.getAllKeys();
  return allKeys.filter(k => k.startsWith(PENDING_PREFIX)).length;
};


export const setupAutoSync = (): (() => void) => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      syncPendingRecords();
    }
  });
  return unsubscribe; 
};