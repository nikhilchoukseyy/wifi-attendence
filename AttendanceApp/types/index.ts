export interface HOD {
  id: string;
  name: string;
  email: string;
  department: string;
  created_at: string;
}

export interface Teacher {
  id: string;
  hod_id: string;
  name: string;
  subject: string;
  year: 1 | 2 | 3 | 4;
  username: string;
  created_at: string;
}

export interface Student {
  id: string;
  hod_id: string;
  name: string;
  enrollment_no: string;
  mobile_no: string;
  year: 1 | 2 | 3 | 4;
  device_id: string | null;
  is_device_bound: boolean;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  teacher_id: string;
  subject: string;
  year: number;
  date: string;
  opened_at: string;
  closed_at: string | null;
  session_pin: string;
  is_active: boolean;
  router_subnet: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent';
  marked_at: string | null;
  is_manual_edit: boolean;
}

export type UserRole = 'student' | 'teacher' | 'hod';

export interface AuthUser {
  role: UserRole;
  data: Student | Teacher | HOD;
}

export interface AttendanceSummary {
  student: Student;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  percentage: number;
}
