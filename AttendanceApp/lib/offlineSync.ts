import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { AttendanceRecord } from '../types';

const PENDING_PREFIX = 'pending_att_';

// STEP 1: Save attendance record locally (instant, no network needed)
// Call this right after all security checks pass
export const saveAttendanceLocally = async (
  record: AttendanceRecord
): Promise<void> => {
  const key = `${PENDING_PREFIX}${record.session_id}_${record.student_id}`;
  await AsyncStorage.setItem(key, JSON.stringify(record));
};

// STEP 2: Sync all pending records to Supabase (call when network available)
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
        await AsyncStorage.removeItem(key); // clean up after successful sync
      } else {
        // Mark as failed for retry
        const updated = { ...record, sync_status: 'failed' as const };
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Sync error for key:', key, e);
    }
  }
};

// Get count of pending (not yet synced) records
export const getPendingCount = async (): Promise<number> => {
  const allKeys = await AsyncStorage.getAllKeys();
  return allKeys.filter(k => k.startsWith(PENDING_PREFIX)).length;
};

// Setup auto-sync listener — call in app _layout.tsx
// Triggers syncPendingRecords whenever network becomes available
export const setupAutoSync = (): (() => void) => {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      syncPendingRecords();
    }
  });
  return unsubscribe; // return unsubscribe function for cleanup
};