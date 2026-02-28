import { create } from 'zustand';
import { AttendanceSession } from '../types';

interface SessionState {
  activeSession: AttendanceSession | null;
  setActiveSession: (session: AttendanceSession | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  setActiveSession: (activeSession) => set({ activeSession }),
}));
