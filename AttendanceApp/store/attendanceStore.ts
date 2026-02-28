import { create } from 'zustand';
import { AttendanceRecord } from '../types';

interface AttendanceState {
  records: AttendanceRecord[];
  setRecords: (records: AttendanceRecord[]) => void;
  addRecord: (record: AttendanceRecord) => void;
  updateRecord: (id: string, updates: Partial<AttendanceRecord>) => void;
  clearRecords: () => void;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  records: [],
  setRecords: (records) => set({ records }),
  addRecord: (record) =>
    set((state) => {
      // Avoid duplicates based on session_id + student_id
      const exists = state.records.some(
        (r) => r.session_id === record.session_id && r.student_id === record.student_id
      );
      if (exists) return state;
      return { records: [...state.records, record] };
    }),
  updateRecord: (id, updates) =>
    set((state) => ({
      records: state.records.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),
  clearRecords: () => set({ records: [] }),
}));
